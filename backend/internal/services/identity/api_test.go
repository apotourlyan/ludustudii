//go:build integration

package identity_test

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/app/api"
	"github.com/apotourlyan/ludustudii/internal/app/router"
	"github.com/apotourlyan/ludustudii/internal/services/identity"
	"github.com/apotourlyan/ludustudii/internal/testkit"
)

func TestMain(m *testing.M) {
	os.Exit(testkit.Run(m))
}

const cookieName = "__Host-session"

// newServer serves the API surface alone on a new database, with the test
// identity configuration.
func newServer(t *testing.T) (*httptest.Server, *sql.DB) {
	t.Helper()
	db := testkit.NewDB(t)
	return newServerOn(t, db, testkit.IdentityConfig()), db
}

func newServerOn(t *testing.T, db *sql.DB, cfg identity.Config) *httptest.Server {
	t.Helper()
	log := slog.New(slog.DiscardHandler)
	onError := router.ErrorHandler(log)
	surface, err := api.New(db, cfg, onError)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(router.New(log, onError, surface))
	t.Cleanup(srv.Close)
	return srv
}

func credentials(email, password string) string {
	b, _ := json.Marshal(map[string]string{"email": email, "password": password})
	return string(b)
}

func register(t *testing.T, srv *httptest.Server, body string) testkit.Response {
	t.Helper()
	return testkit.Do(t, srv, testkit.DoOpts{Method: http.MethodPost, Path: "/api/users", ContentType: "application/json", Body: body})
}

func login(t *testing.T, srv *httptest.Server, body string, cookies ...*http.Cookie) testkit.Response {
	t.Helper()
	return testkit.Do(t, srv, testkit.DoOpts{
		Method: http.MethodPost, Path: "/api/sessions", ContentType: "application/json", Body: body, Cookies: cookies,
	})
}

// assertSessionCookie checks the attributes of a session cookie set by resp
// and returns it.
func assertSessionCookie(t *testing.T, resp testkit.Response) *http.Cookie {
	t.Helper()
	c := resp.Cookie(cookieName)
	if c == nil {
		t.Fatalf("no %s cookie in %v", cookieName, resp.Header.Values("Set-Cookie"))
	}
	if len(c.Value) != 43 || !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteLaxMode ||
		c.Path != "/" || c.Domain != "" || c.MaxAge != 30*24*60*60 {
		t.Errorf("session cookie: %q", resp.Header.Get("Set-Cookie"))
	}
	return c
}

func assertCode(t *testing.T, resp testkit.Response, status int, body string) {
	t.Helper()
	testkit.AssertStatus(t, resp, status)
	testkit.AssertJSON(t, resp.Body, body)
}

// account is a user registered through the API.
type account struct {
	ID, Email, Password string
}

// newAccount registers a user with a unique email and returns it.
func newAccount(t *testing.T, srv *httptest.Server) account {
	t.Helper()
	email := "user-" + strings.ToLower(rand.Text()) + "@example.com"
	const pw = "correct horse battery staple"
	resp := register(t, srv, credentials(email, pw))
	testkit.AssertStatus(t, resp, http.StatusCreated)
	var created struct{ ID string }
	if err := json.Unmarshal(resp.Body, &created); err != nil {
		t.Fatal(err)
	}
	return account{ID: created.ID, Email: email, Password: pw}
}

// hasSession reports whether the database holds an unexpired session for
// the token in c.
func hasSession(t *testing.T, db *sql.DB, c *http.Cookie) bool {
	t.Helper()
	raw, err := base64.RawURLEncoding.DecodeString(c.Value)
	if err != nil {
		t.Fatalf("session cookie %q: %v", c.Value, err)
	}
	sum := sha256.Sum256(raw)
	var ok bool
	if err := db.QueryRowContext(t.Context(),
		`SELECT EXISTS (SELECT 1 FROM sessions WHERE token_hash = $1 AND expires_at > now())`, sum[:],
	).Scan(&ok); err != nil {
		t.Fatal(err)
	}
	return ok
}

func TestRegister(t *testing.T) {
	t.Parallel()
	srv, _ := newServer(t)

	resp := register(t, srv, credentials("  Armen@Example.COM ", "correct horse battery staple"))
	testkit.AssertStatus(t, resp, http.StatusCreated)
	var user struct{ ID, Email string }
	if err := json.Unmarshal(resp.Body, &user); err != nil {
		t.Fatal(err)
	}
	if user.Email != "armen@example.com" {
		t.Errorf("email: got %q, want it canonical", user.Email)
	}
	if resp.Cookie(cookieName) != nil {
		t.Error("registration set a session cookie")
	}
}

func TestRegister_FieldErrors(t *testing.T) {
	t.Parallel()
	srv, _ := newServer(t)
	const pw = "correct horse battery staple"

	for _, tt := range []struct {
		name, body, want string
	}{
		{"empty body", ``, `[{"field":"email","code":"required"},{"field":"password","code":"required"}]`},
		{"email required", credentials("   ", pw), `[{"field":"email","code":"required"}]`},
		{"email without @", credentials("armen.example.com", pw), `[{"field":"email","code":"invalid_format"}]`},
		{"email with two @", credentials("a@b@c", pw), `[{"field":"email","code":"invalid_format"}]`},
		{"email too long", credentials(strings.Repeat("a", 253)+"@b", pw), `[{"field":"email","code":"max_length"}]`},
		{"password required", credentials("a@b", ""), `[{"field":"password","code":"required"}]`},
		{"password too short", credentials("a@b", strings.Repeat("a", 14)), `[{"field":"password","code":"min_length"}]`},
		{"password too long", credentials("a@b", strings.Repeat("a", 129)), `[{"field":"password","code":"max_length"}]`},
		{"password with a tab", credentials("a@b", "correct\thorse battery"), `[{"field":"password","code":"invalid_characters"}]`},
		// A raw 0xFF byte, which JSON decoding turns into U+FFFD.
		{"password with invalid UTF-8", "{\"email\":\"a@b\",\"password\":\"correct horse \xff battery\"}", `[{"field":"password","code":"invalid_characters"}]`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			resp := register(t, srv, tt.body)
			assertCode(t, resp, http.StatusBadRequest, `{"code":"validation_error","errors":`+tt.want+`}`)
		})
	}

	t.Run("password at its limits, spaces kept", func(t *testing.T) {
		t.Parallel()
		for i, pw := range []string{strings.Repeat(" ", 15), strings.Repeat("\U0001F600", 128)} {
			resp := register(t, srv, credentials("limits-"+strconv.Itoa(i)+"@example.com", pw))
			testkit.AssertStatus(t, resp, http.StatusCreated)
		}
	})

	t.Run("unknown field", func(t *testing.T) {
		t.Parallel()
		resp := register(t, srv, `{"email":"a@b","password":"correct horse battery staple","admin":true}`)
		assertCode(t, resp, http.StatusBadRequest, `{"code":"bind_error"}`)
	})

	t.Run("not JSON", func(t *testing.T) {
		t.Parallel()
		resp := testkit.Do(t, srv, testkit.DoOpts{Method: http.MethodPost, Path: "/api/users", ContentType: "text/plain", Body: "x"})
		assertCode(t, resp, http.StatusUnsupportedMediaType, `{"code":"unsupported_media_type"}`)
	})
}

// An email is taken whatever its case or Unicode form, since it is stored
// canonical.
func TestRegister_Taken(t *testing.T) {
	t.Parallel()
	srv, _ := newServer(t)

	testkit.AssertStatus(t, register(t, srv, credentials("rené@example.com", "correct horse battery staple")), http.StatusCreated)
	for _, email := range []string{"rené@example.com", " RENÉ@Example.com", "René@EXAMPLE.COM"} {
		resp := register(t, srv, credentials(email, "another long password"))
		assertCode(t, resp, http.StatusBadRequest, `{"code":"validation_error","errors":[{"field":"email","code":"taken"}]}`)
	}
}

func TestLogin(t *testing.T) {
	t.Parallel()
	srv, db := newServer(t)
	u := newAccount(t, srv)

	before := time.Now()
	resp := login(t, srv, credentials(" "+strings.ToUpper(u.Email)+" ", u.Password))
	testkit.AssertStatus(t, resp, http.StatusCreated)
	var s struct {
		ID        string    `json:"id"`
		ExpiresAt time.Time `json:"expires_at"`
		User      struct{ ID, Email string }
	}
	if err := json.Unmarshal(resp.Body, &s); err != nil {
		t.Fatal(err)
	}
	if s.User.ID != u.ID || s.User.Email != u.Email {
		t.Errorf("user: got %+v, want %s %s", s.User, u.ID, u.Email)
	}
	if want := before.Add(7 * 24 * time.Hour); s.ExpiresAt.Before(want.Add(-time.Minute)) || s.ExpiresAt.After(want.Add(time.Minute)) {
		t.Errorf("expires_at: got %v, want about %v", s.ExpiresAt, want)
	}
	session := assertSessionCookie(t, resp)
	if !hasSession(t, db, session) {
		t.Error("no session stored for the login's cookie")
	}

	// The token is not stored; its hash is, and it isn't in the body.
	var stored []byte
	if err := db.QueryRowContext(t.Context(), `SELECT token_hash FROM sessions WHERE user_id = $1`, u.ID).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if len(stored) != 32 || string(stored) == session.Value || strings.Contains(string(resp.Body), session.Value) {
		t.Errorf("token storage: %d-byte hash, body %s", len(stored), resp.Body)
	}
}

// A login deletes the session its request carried, so a token planted
// before it is worthless after it.
func TestLogin_ReplacesCarriedSession(t *testing.T) {
	t.Parallel()
	srv, db := newServer(t)
	u := newAccount(t, srv)
	carried := assertSessionCookie(t, login(t, srv, credentials(u.Email, u.Password)))

	resp := login(t, srv, credentials(u.Email, u.Password), carried)
	testkit.AssertStatus(t, resp, http.StatusCreated)
	fresh := assertSessionCookie(t, resp)
	if fresh.Value == carried.Value {
		t.Fatal("login reused the carried token")
	}
	if hasSession(t, db, carried) {
		t.Error("the carried session survived the login")
	}
	if !hasSession(t, db, fresh) {
		t.Error("no session stored for the new cookie")
	}

	// A failed login leaves the carried session alone.
	testkit.AssertStatus(t, login(t, srv, credentials(u.Email, "wrong password"), fresh), http.StatusUnauthorized)
	if !hasSession(t, db, fresh) {
		t.Error("a failed login ended the carried session")
	}
}

func TestLogin_Failures(t *testing.T) {
	t.Parallel()
	srv, _ := newServer(t)
	u := newAccount(t, srv)

	unknown := login(t, srv, credentials("nobody@example.com", u.Password))
	wrong := login(t, srv, credentials(u.Email, "the wrong password"))
	for _, resp := range []testkit.Response{unknown, wrong} {
		assertCode(t, resp, http.StatusUnauthorized, `{"code":"invalid_credentials"}`)
		if resp.Cookie(cookieName) != nil || resp.Header.Get("WWW-Authenticate") != "" {
			t.Errorf("failed login headers: %v", resp.Header)
		}
	}
	if string(unknown.Body) != string(wrong.Body) {
		t.Errorf("unknown email %s, wrong password %s; want the same body", unknown.Body, wrong.Body)
	}

	// Login checks only presence and maximum length: a password too short
	// for registration is a wrong password, not a validation error.
	assertCode(t, login(t, srv, credentials(u.Email, "short")), http.StatusUnauthorized, `{"code":"invalid_credentials"}`)
	assertCode(t, login(t, srv, credentials("not an email", u.Password)), http.StatusUnauthorized, `{"code":"invalid_credentials"}`)

	for _, tt := range []struct{ name, body, want string }{
		{"empty body", ``, `[{"field":"email","code":"required"},{"field":"password","code":"required"}]`},
		{"email too long", credentials(strings.Repeat("a", 255), "pw"), `[{"field":"email","code":"max_length"}]`},
		{"password too long", credentials(u.Email, strings.Repeat("a", 129)), `[{"field":"password","code":"max_length"}]`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assertCode(t, login(t, srv, tt.body), http.StatusBadRequest, `{"code":"validation_error","errors":`+tt.want+`}`)
		})
	}
}

// A login under new hashing parameters stores a new hash of the password,
// and the password keeps working.
func TestLogin_Rehash(t *testing.T) {
	t.Parallel()
	db := testkit.NewDB(t)
	oldSrv := newServerOn(t, db, testkit.IdentityConfig())
	u := newAccount(t, oldSrv)

	stronger := testkit.IdentityConfig()
	stronger.Password.Iterations = 2
	newSrv := newServerOn(t, db, stronger)

	hash := func() string {
		var h string
		if err := db.QueryRowContext(t.Context(), `SELECT password_hash FROM users WHERE id = $1`, u.ID).Scan(&h); err != nil {
			t.Fatal(err)
		}
		return h
	}
	if h := hash(); !strings.Contains(h, "$m=64,t=1,p=1$") {
		t.Fatalf("hash before: %q", h)
	}
	testkit.AssertStatus(t, login(t, newSrv, credentials(u.Email, u.Password)), http.StatusCreated)
	if h := hash(); !strings.Contains(h, "$m=64,t=2,p=1$") {
		t.Errorf("hash after a login under new parameters: %q", h)
	}
	testkit.AssertStatus(t, login(t, newSrv, credentials(u.Email, u.Password)), http.StatusCreated)
}

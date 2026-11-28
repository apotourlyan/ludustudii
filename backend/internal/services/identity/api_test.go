//go:build integration

package identity_test

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/apotourlyan/ludustudii/internal/app/api"
	"github.com/apotourlyan/ludustudii/internal/app/router"
	"github.com/apotourlyan/ludustudii/internal/services/identity"
	"github.com/apotourlyan/ludustudii/internal/testkit"
)

func TestMain(m *testing.M) {
	os.Exit(testkit.Run(m))
}

// newServer serves the API surface alone on a new database, with the test
// identity configuration.
func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	return newServerOn(t, testkit.NewDB(t), testkit.IdentityConfig())
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

func assertCode(t *testing.T, resp testkit.Response, status int, body string) {
	t.Helper()
	testkit.AssertStatus(t, resp, status)
	testkit.AssertJSON(t, resp.Body, body)
}

func TestRegister(t *testing.T) {
	t.Parallel()
	srv := newServer(t)

	resp := register(t, srv, credentials("  Armen@Example.COM ", "correct horse battery staple"))
	testkit.AssertStatus(t, resp, http.StatusCreated)
	var user struct{ ID, Email string }
	if err := json.Unmarshal(resp.Body, &user); err != nil {
		t.Fatal(err)
	}
	if user.Email != "armen@example.com" {
		t.Errorf("email: got %q, want it canonical", user.Email)
	}
}

func TestRegister_FieldErrors(t *testing.T) {
	t.Parallel()
	srv := newServer(t)
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
	srv := newServer(t)

	testkit.AssertStatus(t, register(t, srv, credentials("rené@example.com", "correct horse battery staple")), http.StatusCreated)
	for _, email := range []string{"rené@example.com", " RENÉ@Example.com", "René@EXAMPLE.COM"} {
		resp := register(t, srv, credentials(email, "another long password"))
		assertCode(t, resp, http.StatusBadRequest, `{"code":"validation_error","errors":[{"field":"email","code":"taken"}]}`)
	}
}

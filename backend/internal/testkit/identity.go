package testkit

import (
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit/password"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
)

// IdentityConfig returns the identity configuration for tests: hashing
// parameters cheap enough to keep tests fast, and the production session
// times.
func IdentityConfig() domain.Config {
	return domain.Config{
		Password:        password.Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32},
		HashConcurrency: 8,
		Session: domain.SessionPolicy{
			IdleTimeout:     7 * 24 * time.Hour,
			AbsoluteTimeout: 30 * 24 * time.Hour,
			TouchInterval:   time.Minute,
		},
		SessionCleanupInterval: time.Hour,
	}
}

// User is an account NewUser registered, with the session registration
// started.
type User struct {
	ID       string
	Email    string
	Password string
	Session  *http.Cookie
}

// NewUser registers a user with a unique email through POST /api/users on
// s and returns it with its session cookie. It fails the test unless the
// registration succeeds.
func NewUser(t *testing.T, s *httptest.Server) User {
	t.Helper()
	email := "user-" + strings.ToLower(rand.Text()) + "@example.com"
	const pw = "correct horse battery staple"
	body, err := json.Marshal(map[string]string{"email": email, "password": pw})
	if err != nil {
		t.Fatal(err)
	}
	resp := Do(t, s, DoOpts{
		Method:      http.MethodPost,
		Path:        domain.UsersPath,
		ContentType: "application/json",
		Body:        string(body),
	})
	AssertStatus(t, resp, http.StatusCreated)
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(resp.Body, &created); err != nil {
		t.Fatalf("decode registered user: %v", err)
	}
	session := resp.Cookie(domain.SessionCookieName)
	if session == nil {
		t.Fatalf("registration set no %s cookie", domain.SessionCookieName)
	}
	return User{ID: created.ID, Email: email, Password: pw, Session: session}
}

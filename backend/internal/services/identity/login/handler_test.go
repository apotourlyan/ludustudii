//go:build unit

package login

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/kit/erresp"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/kit/validator"
	"github.com/apotourlyan/ludustudii/internal/services/identity/sessions"
)

const (
	userID    = "019a0000-0000-7000-8000-000000000001"
	sessionID = "019a0000-0000-7000-8000-000000000002"
	userHash  = "$argon2id$user"
	dummyHash = "$argon2id$dummy"
)

var start = time.Date(2026, 11, 28, 9, 0, 0, 0, time.UTC)

type mockStore struct {
	findFn   func(ctx context.Context, email string) (user, error)
	updateFn func(ctx context.Context, id, hash string) error
}

func (m *mockStore) FindByEmail(ctx context.Context, email string) (user, error) {
	return m.findFn(ctx, email)
}

func (m *mockStore) UpdatePasswordHash(ctx context.Context, id, hash string) error {
	return m.updateFn(ctx, id, hash)
}

type mockHasher struct {
	hashFn   func(ctx context.Context, password string) (string, error)
	verifyFn func(ctx context.Context, password, encoded string) (bool, bool, error)
}

func (m *mockHasher) Hash(ctx context.Context, password string) (string, error) {
	return m.hashFn(ctx, password)
}

func (m *mockHasher) Verify(ctx context.Context, password, encoded string) (bool, bool, error) {
	return m.verifyFn(ctx, password, encoded)
}

type mockSessions struct {
	replaceFn func(ctx context.Context, w http.ResponseWriter, r *http.Request, userID string) (sessions.Session, error)
}

func (m *mockSessions) Replace(ctx context.Context, w http.ResponseWriter, r *http.Request, userID string) (sessions.Session, error) {
	return m.replaceFn(ctx, w, r, userID)
}

type mocks struct {
	store    *mockStore
	hasher   *mockHasher
	sessions *mockSessions
	verified []string // the hashes Verify was given
}

func testContext(t *testing.T, body string) (*http.Request, *httptest.ResponseRecorder) {
	t.Helper()
	r := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/sessions", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.RemoteAddr = "192.0.2.7:51000"
	return r, httptest.NewRecorder()
}

// testHandler returns a Handler for a known user whose password matches,
// with an up-to-date hash, under limits that allow everything. setup changes
// what a test needs.
func testHandler(t *testing.T, setup func(*Handler, *mocks)) (*Handler, *mocks) {
	t.Helper()
	m := &mocks{
		store: &mockStore{
			findFn: func(_ context.Context, email string) (user, error) {
				return user{ID: userID, Email: email, PasswordHash: userHash}, nil
			},
			updateFn: func(context.Context, string, string) error {
				t.Fatal("unexpected call to updateFn")
				return nil
			},
		},
		sessions: &mockSessions{replaceFn: func(_ context.Context, w http.ResponseWriter, _ *http.Request, _ string) (sessions.Session, error) {
			w.Header().Set("Set-Cookie", "__Host-session=token")
			return sessions.Session{ID: sessionID, ExpiresAt: start.Add(7 * 24 * time.Hour)}, nil
		}},
	}
	m.hasher = &mockHasher{
		hashFn: func(context.Context, string) (string, error) {
			t.Fatal("unexpected call to hashFn")
			return "", nil
		},
		verifyFn: func(_ context.Context, _, encoded string) (bool, bool, error) {
			m.verified = append(m.verified, encoded)
			return encoded == userHash, false, nil
		},
	}
	h := &Handler{
		store:     m.store,
		hasher:    m.hasher,
		dummyHash: dummyHash,
		sessions:  m.sessions,
		bind: func(_ *http.Request, i any) error {
			*i.(*request) = request{Email: "a@example.com", Password: "pw"}
			return nil
		},
		validate: func(request) error { return nil },
	}
	if setup != nil {
		setup(h, m)
	}
	return h, m
}

func TestHandler_Failures(t *testing.T) {
	t.Parallel()

	unknown := func(_ *Handler, m *mocks) {
		m.store.findFn = func(context.Context, string) (user, error) { return user{}, kit.ErrNotFound }
	}
	tests := []struct {
		name        string
		setup       func(*Handler, *mocks)
		wantCode    int
		wantErrCode string
		wantVerify  []string // the hashes verified, nil for none
	}{
		{
			name: "binding error",
			setup: func(h *Handler, _ *mocks) {
				h.bind = func(*http.Request, any) error {
					return &httpkit.StatusError{Code: http.StatusBadRequest, Response: erresp.Binding()}
				}
			},
			wantCode:    http.StatusBadRequest,
			wantErrCode: erresp.CodeBinding,
		},
		{
			name:        "validation error",
			setup:       func(h *Handler, _ *mocks) { h.validate = func(request) error { return errors.New("") } },
			wantCode:    http.StatusBadRequest,
			wantErrCode: erresp.CodeValidation,
		},
		{
			name: "store error",
			setup: func(_ *Handler, m *mocks) {
				m.store.findFn = func(context.Context, string) (user, error) { return user{}, errors.New("") }
			},
			wantCode: http.StatusInternalServerError,
		},
		{
			name:        "unknown email verifies the dummy hash",
			setup:       unknown,
			wantCode:    http.StatusUnauthorized,
			wantErrCode: erresp.CodeInvalidCredentials,
			wantVerify:  []string{dummyHash},
		},
		{
			name: "unknown email fails even if the dummy hash matched",
			setup: func(h *Handler, m *mocks) {
				unknown(h, m)
				m.hasher.verifyFn = func(_ context.Context, _, encoded string) (bool, bool, error) {
					m.verified = append(m.verified, encoded)
					return true, false, nil
				}
			},
			wantCode:    http.StatusUnauthorized,
			wantErrCode: erresp.CodeInvalidCredentials,
			wantVerify:  []string{dummyHash},
		},
		{
			name: "wrong password",
			setup: func(_ *Handler, m *mocks) {
				m.hasher.verifyFn = func(_ context.Context, _, encoded string) (bool, bool, error) {
					m.verified = append(m.verified, encoded)
					return false, false, nil
				}
			},
			wantCode:    http.StatusUnauthorized,
			wantErrCode: erresp.CodeInvalidCredentials,
			wantVerify:  []string{userHash},
		},
		{
			name: "verify error",
			setup: func(_ *Handler, m *mocks) {
				m.hasher.verifyFn = func(context.Context, string, string) (bool, bool, error) {
					return false, false, context.Canceled
				}
			},
			wantCode: http.StatusInternalServerError,
		},
		{
			name: "session error",
			setup: func(_ *Handler, m *mocks) {
				m.sessions.replaceFn = func(context.Context, http.ResponseWriter, *http.Request, string) (sessions.Session, error) {
					return sessions.Session{}, errors.New("")
				}
			},
			wantCode:   http.StatusInternalServerError,
			wantVerify: []string{userHash},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			h, m := testHandler(t, tt.setup)
			r, rec := testContext(t, `{}`)
			err := h.Handle(rec, r)
			if err == nil {
				t.Fatal("expected returned error")
			}
			if rec.Body.Len() != 0 || rec.Header().Get("Location") != "" {
				t.Fatalf("response written: %v %s", rec.Header(), rec.Body.String())
			}
			if tt.wantCode == http.StatusInternalServerError {
				if httpkit.StatusCode(err) != 0 {
					t.Fatalf("expected untyped error, got %v", err)
				}
			} else {
				se, ok := errors.AsType[*httpkit.StatusError](err)
				if !ok || se.Code != tt.wantCode || se.Response.Code != tt.wantErrCode {
					t.Fatalf("returned error: got %#v, want %d %s", err, tt.wantCode, tt.wantErrCode)
				}
			}
			if strings.Join(m.verified, ",") != strings.Join(tt.wantVerify, ",") {
				t.Errorf("verified hashes: got %v, want %v", m.verified, tt.wantVerify)
			}
		})
	}
}

// An unknown email and a wrong password return the very same error.
func TestHandler_SameFailure(t *testing.T) {
	t.Parallel()

	h1, _ := testHandler(t, func(_ *Handler, m *mocks) {
		m.store.findFn = func(context.Context, string) (user, error) { return user{}, kit.ErrNotFound }
	})
	h2, _ := testHandler(t, func(_ *Handler, m *mocks) {
		m.hasher.verifyFn = func(context.Context, string, string) (bool, bool, error) { return false, false, nil }
	})
	r1, rec1 := testContext(t, `{}`)
	r2, rec2 := testContext(t, `{}`)
	err1, err2 := h1.Handle(rec1, r1), h2.Handle(rec2, r2)
	if err1 != err2 || !errors.Is(err1, httpkit.ErrInvalidCredentials) { //nolint:errorlint // Both must be the same sentinel, not merely match it.
		t.Errorf("unknown email %v, wrong password %v; want the same ErrInvalidCredentials", err1, err2)
	}
}

func TestHandler_Success(t *testing.T) {
	t.Parallel()

	var replacedFor string
	h, _ := testHandler(t, func(_ *Handler, m *mocks) {
		next := m.sessions.replaceFn
		m.sessions.replaceFn = func(ctx context.Context, w http.ResponseWriter, r *http.Request, id string) (sessions.Session, error) {
			replacedFor = id
			return next(ctx, w, r, id)
		}
	})
	r, rec := testContext(t, `{}`)
	if err := h.Handle(rec, r); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d, want 201", rec.Code)
	}
	if got := rec.Header().Get("Location"); got != "/api/sessions/current" {
		t.Errorf("Location: got %q", got)
	}
	if replacedFor != userID {
		t.Errorf("session replaced for %q, want %q", replacedFor, userID)
	}
	var got map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"id":         sessionID,
		"expires_at": "2026-12-05T09:00:00Z",
		"user":       map[string]any{"id": userID, "email": "a@example.com"},
	}
	if gotJSON, wantJSON := mustJSON(t, got), mustJSON(t, want); gotJSON != wantJSON {
		t.Errorf("body: got %s, want %s", gotJSON, wantJSON)
	}
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestHandler_Rehash(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name      string
		hashErr   error
		updateErr error
		wantStore bool
	}{
		{name: "stores the new hash", wantStore: true},
		{name: "a hashing failure still logs in", hashErr: context.Canceled},
		{name: "a storage failure still logs in", updateErr: errors.New("boom"), wantStore: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var hashed, storedID, storedHash string
			h, _ := testHandler(t, func(_ *Handler, m *mocks) {
				m.hasher.verifyFn = func(context.Context, string, string) (bool, bool, error) { return true, true, nil }
				m.hasher.hashFn = func(_ context.Context, pw string) (string, error) {
					hashed = pw
					return "$argon2id$new", tt.hashErr
				}
				m.store.updateFn = func(_ context.Context, id, hash string) error {
					storedID, storedHash = id, hash
					return tt.updateErr
				}
			})
			r, rec := testContext(t, `{}`)
			if err := h.Handle(rec, r); err != nil {
				t.Fatal(err)
			}
			if rec.Code != http.StatusCreated {
				t.Fatalf("status: got %d, want 201", rec.Code)
			}
			if hashed != "pw" {
				t.Errorf("rehashed %q, want the password given", hashed)
			}
			if gotStore := storedID != ""; gotStore != tt.wantStore {
				t.Fatalf("stored: got %v, want %v", gotStore, tt.wantStore)
			}
			if tt.wantStore && (storedID != userID || storedHash != "$argon2id$new") {
				t.Errorf("stored %q for %q", storedHash, storedID)
			}
		})
	}
}

// NewHandler wires the real binding, canonicalization and validation: the
// lookup takes the canonical email, while the password is verified as typed
// apart from NFC.
func TestHandler_Wiring(t *testing.T) {
	t.Parallel()

	var foundEmail, verified string
	h := NewHandler(Deps{
		Store: &mockStore{findFn: func(_ context.Context, email string) (user, error) {
			foundEmail = email
			return user{}, kit.ErrNotFound
		}},
		Hasher: &mockHasher{verifyFn: func(_ context.Context, pw, _ string) (bool, bool, error) {
			verified = pw
			return false, false, nil
		}},
		DummyHash: dummyHash,
	})

	body, _ := json.Marshal(request{Email: "  René@Example.COM ", Password: " Café "})
	r, rec := testContext(t, string(body))
	if err := h.Handle(rec, r); !errors.Is(err, httpkit.ErrInvalidCredentials) {
		t.Fatalf("got %v, want ErrInvalidCredentials", err)
	}
	const email = "rené@example.com"
	if foundEmail != email {
		t.Errorf("lookup: got %q, want %q", foundEmail, email)
	}
	if verified != " Café " {
		t.Errorf("verified password %q, want NFC and untrimmed", verified)
	}
}

func TestValidate(t *testing.T) {
	t.Parallel()

	type fieldErr struct{ field, code string }
	for _, tt := range []struct {
		name     string
		req      request
		wantErrs []fieldErr
	}{
		{name: "short password from before a rule change", req: request{Email: "a@b", Password: "x"}},
		{name: "empty", req: request{}, wantErrs: []fieldErr{{"email", validator.CodeRequired}, {"password", validator.CodeRequired}}},
		{name: "password too long", req: request{Email: "a@b", Password: strings.Repeat("a", 129)}, wantErrs: []fieldErr{{"password", validator.CodeMaxLength}}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := erresp.Validation(validate(tt.req)).Errors
			if len(got) != len(tt.wantErrs) {
				t.Fatalf("errors: got %v, want %v", got, tt.wantErrs)
			}
			for i, want := range tt.wantErrs {
				if got[i].Field != want.field || got[i].Code != want.code {
					t.Errorf("errors[%d]: got %s/%s, want %s/%s", i, got[i].Field, got[i].Code, want.field, want.code)
				}
			}
		})
	}
}

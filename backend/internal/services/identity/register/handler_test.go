//go:build unit

package register

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/apotourlyan/ludustudii/internal/kit/erresp"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/kit/validator"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
	"github.com/apotourlyan/ludustudii/internal/services/identity/sessions"
)

const userID = "019a0000-0000-7000-8000-000000000001"

type mockStore struct {
	createFn func(ctx context.Context, p createParams) (row, error)
}

func (m *mockStore) Create(ctx context.Context, p createParams) (row, error) {
	return m.createFn(ctx, p)
}

type mockHasher struct {
	hashFn func(ctx context.Context, password string) (string, error)
}

func (m *mockHasher) Hash(ctx context.Context, password string) (string, error) {
	return m.hashFn(ctx, password)
}

type mockSessions struct {
	startFn func(ctx context.Context, w http.ResponseWriter, userID string) (sessions.Session, error)
}

func (m *mockSessions) Start(ctx context.Context, w http.ResponseWriter, userID string) (sessions.Session, error) {
	return m.startFn(ctx, w, userID)
}

type mocks struct {
	store    *mockStore
	hasher   *mockHasher
	sessions *mockSessions
}

func testContext(t *testing.T, body string) (*http.Request, *httptest.ResponseRecorder) {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/users", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.7:51000"
	return req, httptest.NewRecorder()
}

// testHandler returns a Handler whose every step succeeds without effects
// and whose store, hasher and sessions fail the test unless setup replaces
// them.
func testHandler(t *testing.T, setup func(*Handler, *mocks)) *Handler {
	t.Helper()
	m := &mocks{
		store: &mockStore{createFn: func(context.Context, createParams) (row, error) {
			t.Fatal("unexpected call to createFn")
			return row{}, nil
		}},
		hasher: &mockHasher{hashFn: func(context.Context, string) (string, error) {
			t.Fatal("unexpected call to hashFn")
			return "", nil
		}},
		sessions: &mockSessions{startFn: func(context.Context, http.ResponseWriter, string) (sessions.Session, error) {
			t.Fatal("unexpected call to startFn")
			return sessions.Session{}, nil
		}},
	}
	h := &Handler{
		store:    m.store,
		hasher:   m.hasher,
		sessions: m.sessions,
		bind:     func(*http.Request, any) error { return nil },
		validate: func(request) error { return nil },
	}
	if setup != nil {
		setup(h, m)
	}
	return h
}

func succeed(m *mocks) {
	m.hasher.hashFn = func(context.Context, string) (string, error) { return "$argon2id$hash", nil }
	m.store.createFn = func(_ context.Context, p createParams) (row, error) {
		return row{ID: userID, Email: p.Email}, nil
	}
	m.sessions.startFn = func(_ context.Context, w http.ResponseWriter, _ string) (sessions.Session, error) {
		http.SetCookie(w, &http.Cookie{Name: domain.SessionCookieName, Value: "token"})
		return sessions.Session{}, nil
	}
}

func TestHandler_Handle(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		setup       func(*Handler, *mocks)
		wantCode    int
		wantErrCode string
		wantField   string
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
			name: "hash error",
			setup: func(_ *Handler, m *mocks) {
				m.hasher.hashFn = func(context.Context, string) (string, error) { return "", context.Canceled }
			},
			wantCode: http.StatusInternalServerError,
		},
		{
			name: "email taken",
			setup: func(_ *Handler, m *mocks) {
				succeed(m)
				m.store.createFn = func(context.Context, createParams) (row, error) {
					return row{}, fmt.Errorf("create user: %w", domain.ErrEmailTaken)
				}
			},
			wantCode:    http.StatusBadRequest,
			wantErrCode: erresp.CodeValidation,
			wantField:   "email/taken",
		},
		{
			name: "create error",
			setup: func(_ *Handler, m *mocks) {
				succeed(m)
				m.store.createFn = func(context.Context, createParams) (row, error) { return row{}, errors.New("") }
			},
			wantCode: http.StatusInternalServerError,
		},
		{
			name: "session error",
			setup: func(_ *Handler, m *mocks) {
				succeed(m)
				m.sessions.startFn = func(context.Context, http.ResponseWriter, string) (sessions.Session, error) {
					return sessions.Session{}, errors.New("")
				}
			},
			wantCode: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			r, rec := testContext(t, `{}`)
			err := testHandler(t, tt.setup).Handle(rec, r)
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
				return
			}
			se, ok := errors.AsType[*httpkit.StatusError](err)
			if !ok || se.Code != tt.wantCode || se.Response.Code != tt.wantErrCode {
				t.Fatalf("returned error: got %#v, want %d %s", err, tt.wantCode, tt.wantErrCode)
			}
			if tt.wantField != "" {
				errs := se.Response.Errors
				if len(errs) != 1 || errs[0].Field+"/"+errs[0].Code != tt.wantField {
					t.Errorf("field errors: got %v, want %s", errs, tt.wantField)
				}
			}
		})
	}
}

func TestHandler_Success(t *testing.T) {
	t.Parallel()

	r, rec := testContext(t, `{}`)
	h := testHandler(t, func(_ *Handler, m *mocks) { succeed(m) })
	if err := h.Handle(rec, r); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d, want 201", rec.Code)
	}
	if got := rec.Header().Get("Set-Cookie"); !strings.HasPrefix(got, domain.SessionCookieName+"=") {
		t.Errorf("Set-Cookie: got %q", got)
	}
	var got response
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != userID {
		t.Errorf("response: got %+v", got)
	}
}

// NewHandler wires the real binding, canonicalization and validation: the
// email is stored canonical, the password hashed as typed apart from NFC, the
// session started for the new user.
func TestHandler_Wiring(t *testing.T) {
	t.Parallel()

	var hashed, startedFor string
	var stored createParams
	h := NewHandler(
		&mockStore{createFn: func(_ context.Context, p createParams) (row, error) {
			stored = p
			return row{ID: userID, Email: p.Email}, nil
		}},
		&mockHasher{hashFn: func(_ context.Context, pw string) (string, error) {
			hashed = pw
			return "$argon2id$hash", nil
		}},
		&mockSessions{startFn: func(_ context.Context, _ http.ResponseWriter, id string) (sessions.Session, error) {
			startedFor = id
			return sessions.Session{}, nil
		}},
	)

	body, _ := json.Marshal(request{
		Email:    "  René@Example.COM ",
		Password: "  Café au lait, no sugar  ",
	})
	r, rec := testContext(t, string(body))
	if err := h.Handle(rec, r); err != nil {
		t.Fatal(err)
	}

	if want := "  Café au lait, no sugar  "; hashed != want {
		t.Errorf("hashed password: got %q, want %q", hashed, want)
	}
	if want := (createParams{Email: "rené@example.com", PasswordHash: "$argon2id$hash"}); stored != want {
		t.Errorf("stored: got %+q, want %+q", stored, want)
	}
	if startedFor != userID {
		t.Errorf("session started for %q, want %q", startedFor, userID)
	}
	assertResponse(t, rec.Body.Bytes(), response{ID: userID, Email: "rené@example.com"})
}

func assertResponse(t *testing.T, body []byte, want response) {
	t.Helper()
	var got response
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Errorf("response: got %+v, want %+v", got, want)
	}
}

func TestValidate(t *testing.T) {
	t.Parallel()

	type fieldErr struct{ field, code string }
	tests := []struct {
		name     string
		req      request
		wantErrs []fieldErr
	}{
		{name: "valid", req: request{Email: "a@b", Password: "correct horse battery"}},
		{name: "empty", req: request{}, wantErrs: []fieldErr{{"email", validator.CodeRequired}, {"password", validator.CodeRequired}}},
		{
			name:     "both invalid",
			req:      request{Email: "nope", Password: "short"},
			wantErrs: []fieldErr{{"email", domain.CodeInvalidFormat}, {"password", validator.CodeMinLength}},
		},
	}
	for _, tt := range tests {
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

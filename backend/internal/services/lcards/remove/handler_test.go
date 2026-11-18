//go:build unit

package remove

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/kit/erresp"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
)

type mockStore struct {
	deleteFn func(ctx context.Context, id string) error
}

func (m *mockStore) Delete(ctx context.Context, id string) error {
	return m.deleteFn(ctx, id)
}

func testContext(t *testing.T, id string) (*http.Request, *httptest.ResponseRecorder) {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/api/lcards/"+id, nil)
	rec := httptest.NewRecorder()
	req.SetPathValue("id", id)
	return req, rec
}

func testHandler(t *testing.T, store func(*mockStore), setup func(*Handler)) *Handler {
	t.Helper()

	m := &mockStore{
		deleteFn: func(ctx context.Context, id string) error {
			t.Fatal("unexpected call to deleteFn")
			return errors.New("")
		},
	}
	if store != nil {
		store(m)
	}

	h := &Handler{
		store:           m,
		validateParamID: func(id string) error { return nil },
	}
	if setup != nil {
		setup(h)
	}

	return h
}

func TestHandler_Handle(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		setup       func(*Handler)
		store       func(*mockStore)
		wantCode    int
		wantErrCode string
	}{
		{
			name: "path validation error",
			setup: func(h *Handler) {
				h.validateParamID = func(id string) error {
					return errors.New("")
				}
			},
			wantCode:    http.StatusBadRequest,
			wantErrCode: erresp.CodeValidation,
		},
		{
			name: "not found error",
			store: func(m *mockStore) {
				m.deleteFn = func(_ context.Context, _ string) error {
					return kit.ErrNotFound
				}
			},
			wantCode:    http.StatusNotFound,
			wantErrCode: erresp.CodeNotFound,
		},
		{
			name: "delete error",
			store: func(m *mockStore) {
				m.deleteFn = func(_ context.Context, _ string) error {
					return errors.New("")
				}
			},
			wantCode:    http.StatusInternalServerError,
			wantErrCode: erresp.CodeUnexpected,
		},
		{
			name: "success",
			store: func(m *mockStore) {
				m.deleteFn = func(_ context.Context, _ string) error {
					return nil
				}
			},
			wantCode: http.StatusNoContent,
		},
	}

	const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			// Setup request and request/response recorder
			c, rec := testContext(t, id)

			// Setup handler with mock store
			h := testHandler(t, tt.store, tt.setup)

			err := h.Handle(rec, c)
			if tt.wantErrCode != "" {
				if err == nil {
					t.Fatal("expected returned error")
				}
				if rec.Body.Len() != 0 || rec.Flushed || len(rec.Header()) != 0 {
					t.Fatalf("error response was written: %s", rec.Body.String())
				}
				switch tt.wantCode {
				case http.StatusInternalServerError:
					if httpkit.StatusCode(err) != 0 {
						t.Fatalf("expected untyped store error, got %v", err)
					}
				case http.StatusNotFound:
					if !errors.Is(err, kit.ErrNotFound) {
						t.Fatalf("expected not found, got %v", err)
					}
				default:
					typed, ok := errors.AsType[*httpkit.StatusError](err)
					if !ok || typed.Code != tt.wantCode || typed.Response.Code != tt.wantErrCode {
						t.Fatalf("returned error: got %#v, want %d %s", err, tt.wantCode, tt.wantErrCode)
					}
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			// Check the status code first
			if rec.Code != tt.wantCode {
				t.Fatalf("status: got %d, want %d", rec.Code, tt.wantCode)
			}
		})
	}
}

func TestHandler_Wiring(t *testing.T) {
	t.Parallel()

	c, rec := testContext(t, "01A1730E-199D-7F9F-B59D-3BCD6F84066C")

	var gotID string
	m := &mockStore{
		deleteFn: func(_ context.Context, id string) error {
			gotID = id
			return nil
		},
	}
	h := NewHandler(m)

	if err := h.Handle(rec, c); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: got %d, want %d", rec.Code, http.StatusNoContent)
	}

	wantID := "01a1730e-199d-7f9f-b59d-3bcd6f84066c" // lowercased
	if gotID != wantID {
		t.Errorf("id: got %q, want %q", gotID, wantID)
	}

	if rec.Body.Len() != 0 {
		t.Errorf("body: got %q, want empty", rec.Body.String())
	}
}

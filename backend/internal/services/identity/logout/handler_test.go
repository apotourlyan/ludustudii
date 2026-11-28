//go:build unit

package logout

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type mockSessions struct {
	endFn func(ctx context.Context, w http.ResponseWriter, r *http.Request) error
}

func (m *mockSessions) End(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	return m.endFn(ctx, w, r)
}

func TestHandler_Handle(t *testing.T) {
	t.Parallel()

	t.Run("ends the session", func(t *testing.T) {
		t.Parallel()
		var ended *http.Request
		h := NewHandler(&mockSessions{endFn: func(_ context.Context, w http.ResponseWriter, r *http.Request) error {
			ended = r
			w.Header().Set("Set-Cookie", "__Host-session=; Max-Age=0")
			return nil
		}})
		rec := httptest.NewRecorder()
		r := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/api/sessions/current", nil)
		if err := h.Handle(rec, r); err != nil {
			t.Fatal(err)
		}
		if ended != r || rec.Code != http.StatusNoContent || rec.Body.Len() != 0 || rec.Header().Get("Set-Cookie") == "" {
			t.Errorf("got %d %q, cookie %q", rec.Code, rec.Body.String(), rec.Header().Get("Set-Cookie"))
		}
	})

	t.Run("store error", func(t *testing.T) {
		t.Parallel()
		boom := errors.New("boom")
		h := NewHandler(&mockSessions{endFn: func(context.Context, http.ResponseWriter, *http.Request) error { return boom }})
		rec := httptest.NewRecorder()
		if err := h.Handle(rec, httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/api/sessions/current", nil)); !errors.Is(err, boom) {
			t.Errorf("got %v, want %v", err, boom)
		}
	})
}

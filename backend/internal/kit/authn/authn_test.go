//go:build unit

package authn

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
)

func TestUserID(t *testing.T) {
	t.Parallel()

	if id, ok := UserID(t.Context()); ok || id != "" {
		t.Errorf("anonymous: got %q, %v", id, ok)
	}
	if id, ok := UserID(WithUserID(t.Context(), "")); ok || id != "" {
		t.Errorf("empty ID: got %q, %v; want anonymous", id, ok)
	}
	const want = "019a0000-0000-7000-8000-000000000001"
	if id, ok := UserID(WithUserID(t.Context(), want)); !ok || id != want {
		t.Errorf("authenticated: got %q, %v; want %q, true", id, ok, want)
	}
}

func TestRequire(t *testing.T) {
	t.Parallel()

	var got string
	h := Require(func(w http.ResponseWriter, r *http.Request) error {
		got, _ = UserID(r.Context())
		return httpkit.NoContent(w, http.StatusNoContent)
	})

	rec := httptest.NewRecorder()
	r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	if err := h(rec, r); !errors.Is(err, httpkit.ErrUnauthenticated) {
		t.Fatalf("anonymous: got %v, want ErrUnauthenticated", err)
	}
	if got != "" || rec.Body.Len() != 0 || len(rec.Header()) != 0 {
		t.Fatalf("anonymous request reached the handler or wrote a response")
	}

	const id = "019a0000-0000-7000-8000-000000000001"
	rec = httptest.NewRecorder()
	r = httptest.NewRequestWithContext(WithUserID(t.Context(), id), http.MethodGet, "/", nil)
	if err := h(rec, r); err != nil {
		t.Fatalf("authenticated: %v", err)
	}
	if got != id || rec.Code != http.StatusNoContent {
		t.Errorf("authenticated: handler saw %q, status %d", got, rec.Code)
	}
}

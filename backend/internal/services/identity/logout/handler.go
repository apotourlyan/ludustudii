// Package logout implements logging out: ending the session the request
// carries. It has no store of its own; the session store is shared by the
// identity endpoints (package sessions).
package logout

import (
	"context"
	"net/http"

	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
)

type sessionEnder interface {
	End(ctx context.Context, w http.ResponseWriter, r *http.Request) error
}

// Handler serves the DELETE /api/sessions/current endpoint.
type Handler struct {
	sessions sessionEnder
}

// NewHandler returns a Handler that ends sessions with s.
func NewHandler(s sessionEnder) *Handler {
	return &Handler{sessions: s}
}

// Handle deletes the request's session, if any, expires the session cookie
// and responds 204, with or without a session.
func (h *Handler) Handle(w http.ResponseWriter, r *http.Request) error {
	if err := h.sessions.End(r.Context(), w, r); err != nil {
		return err
	}
	return httpkit.NoContent(w, http.StatusNoContent)
}

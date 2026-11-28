// Package me implements reading the current user.
package me

import (
	"context"
	"errors"
	"net/http"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/kit/authn"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
)

type response struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type getter interface {
	Get(ctx context.Context, id string) (row, error)
}

// Handler serves the GET /api/users/me endpoint. Register it wrapped in
// authn.Require.
type Handler struct {
	store getter
}

// NewHandler returns a Handler that uses s for storage.
func NewHandler(s getter) *Handler {
	return &Handler{store: s}
}

// Handle responds 200 with the authenticated user, or 401 unauthenticated
// for an anonymous request or a user deleted since the session was resolved.
func (h *Handler) Handle(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id, ok := authn.UserID(ctx)
	if !ok {
		return httpkit.ErrUnauthenticated
	}

	data, err := h.store.Get(ctx, id)
	if errors.Is(err, kit.ErrNotFound) {
		return httpkit.ErrUnauthenticated
	}
	if err != nil {
		return err
	}

	return httpkit.JSON(w, http.StatusOK, response(data))
}

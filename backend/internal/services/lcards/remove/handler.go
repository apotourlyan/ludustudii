// Package remove implements deleting a learning card.
package remove

import (
	"context"
	"net/http"
	"strings"

	"github.com/apotourlyan/ludustudii/internal/kit/etag"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/kit/validator"
)

type deleter interface {
	Delete(ctx context.Context, p deleteParams) error
}

// Handler serves the DELETE /api/lcards/{id} endpoint.
type Handler struct {
	store           deleter
	validateParamID func(id string) error
	parseVersion    func(string) (int64, error)
}

// NewHandler returns a Handler that uses s for storage.
func NewHandler(s deleter) *Handler {
	return &Handler{
		store:           s,
		validateParamID: validateParamID,
		parseVersion:    etag.ParseVersion,
	}
}

// Handle deletes the card whose ID is the {id} path parameter and responds 204,
// 400 for an invalid ID, 404 for an unknown ID, or 412 for a stale or
// malformed If-Match. Without If-Match it deletes whatever the version.
func (h *Handler) Handle(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id := strings.ToLower(r.PathValue("id"))
	if err := h.validateParamID(id); err != nil {
		return httpkit.Validation(err)
	}

	ifMatch := r.Header.Values("If-Match")
	var version int64
	if len(ifMatch) > 0 {
		// A malformed tag leaves version 0, which no card has, so it fails as stale.
		version, _ = h.parseVersion(strings.Join(ifMatch, ","))
	}

	if err := h.store.Delete(ctx, deleteParams{ID: id, IfMatch: len(ifMatch) > 0, Version: version}); err != nil {
		return err
	}

	return httpkit.NoContent(w, http.StatusNoContent)
}

func validateParamID(id string) error {
	return validator.UUID7("id", id)
}

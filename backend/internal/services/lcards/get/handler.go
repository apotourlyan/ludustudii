// Package get implements fetching a single learning card.
package get

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/kit/validator"
)

type response struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type getter interface {
	Get(ctx context.Context, id string) (row, error)
}

// Handler serves the GET /api/lcards/{id} endpoint.
type Handler struct {
	store           getter
	validateParamID func(id string) error
}

// NewHandler returns a Handler that uses s for storage.
func NewHandler(s getter) *Handler {
	return &Handler{store: s, validateParamID: validateParamID}
}

// Handle responds 200 with the card whose ID is the {id} path parameter, 400 if
// the ID is not a UUIDv7 (case-insensitive) and 404 if no card has it.
func (h *Handler) Handle(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id := strings.ToLower(r.PathValue("id"))
	if err := h.validateParamID(id); err != nil {
		return httpkit.Validation(err)
	}

	data, err := h.store.Get(ctx, id)
	if err != nil {
		return err
	}

	return httpkit.JSON(w, http.StatusOK, toResp(data))
}

func validateParamID(id string) error {
	return validator.UUID7("id", id)
}

// toResp returns the card with its timestamps in UTC, which JSON encodes as
// RFC 3339.
func toResp(data row) response {
	return response{
		ID:          data.ID,
		Title:       data.Title,
		Description: data.Description,
		CreatedAt:   data.CreatedAt.UTC(),
		UpdatedAt:   data.UpdatedAt.UTC(),
	}
}

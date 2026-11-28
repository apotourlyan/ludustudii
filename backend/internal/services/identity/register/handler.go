// Package register implements registering a user, which also logs it in.
package register

import (
	"context"
	"errors"
	"net/http"

	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/kit/validator"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
)

type request struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type response struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type creator interface {
	Create(ctx context.Context, p createParams) (row, error)
}

type hasher interface {
	Hash(ctx context.Context, password string) (string, error)
}

// Handler serves the POST /api/users endpoint.
type Handler struct {
	store    creator
	hasher   hasher
	bind     func(r *http.Request, i any) error
	validate func(req request) error
}

// NewHandler returns a Handler that stores users in s and hashes passwords
// with h.
func NewHandler(s creator, h hasher) *Handler {
	return &Handler{
		store:    s,
		hasher:   h,
		bind:     bind,
		validate: validate,
	}
}

// Handle registers a user: it canonicalizes and validates the JSON email and
// password (400 for invalid ones, including an email that has an account),
// stores the user with its password hash and responds 201 with the user.
func (h *Handler) Handle(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	var req request
	if err := h.bind(r, &req); err != nil {
		return err
	}

	sanitize(&req)

	if err := h.validate(req); err != nil {
		return httpkit.Validation(err)
	}

	hash, err := h.hasher.Hash(ctx, req.Password)
	if err != nil {
		return err
	}

	data, err := h.store.Create(ctx, createParams{Email: req.Email, PasswordHash: hash})
	if errors.Is(err, domain.ErrEmailTaken) {
		return httpkit.Validation(validator.NewFieldError("email", domain.CodeTaken, err))
	}
	if err != nil {
		return err
	}

	return httpkit.JSON(w, http.StatusCreated, response(data))
}

func bind(r *http.Request, i any) error {
	return httpkit.BindJSON(r, i)
}

func validate(req request) error {
	return errors.Join(
		domain.ValidateEmail(req.Email),
		domain.ValidatePassword(req.Password),
	)
}

func sanitize(req *request) {
	req.Email = domain.CanonicalEmail(req.Email)
	req.Password = domain.CanonicalPassword(req.Password)
}

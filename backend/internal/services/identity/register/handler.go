// Package register implements registering a user, which also logs it in.
package register

import (
	"context"
	"errors"
	"net/http"

	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/kit/validator"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
	"github.com/apotourlyan/ludustudii/internal/services/identity/sessions"
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

type sessionStarter interface {
	Start(ctx context.Context, w http.ResponseWriter, userID string) (sessions.Session, error)
}

// Handler serves the POST /api/users endpoint.
type Handler struct {
	store    creator
	hasher   hasher
	sessions sessionStarter
	bind     func(r *http.Request, i any) error
	validate func(req request) error
}

// NewHandler returns a Handler that stores users in s, hashes passwords with
// h and starts sessions with sm.
func NewHandler(s creator, h hasher, sm sessionStarter) *Handler {
	return &Handler{
		store:    s,
		hasher:   h,
		sessions: sm,
		bind:     bind,
		validate: validate,
	}
}

// Handle registers a user: it canonicalizes and validates the JSON email and
// password (400 for invalid ones, including an email that has an account),
// stores the user with its password hash, starts a session and responds 201
// with the user and the session cookie.
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

	if _, err := h.sessions.Start(ctx, w, data.ID); err != nil {
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

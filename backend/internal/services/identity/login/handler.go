// Package login implements logging in: creating a session for an email and
// password.
package login

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
	"github.com/apotourlyan/ludustudii/internal/services/identity/sessions"
)

type request struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type userResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type response struct {
	ID        string       `json:"id"`
	ExpiresAt time.Time    `json:"expires_at"`
	User      userResponse `json:"user"`
}

type userStore interface {
	FindByEmail(ctx context.Context, email string) (user, error)
	UpdatePasswordHash(ctx context.Context, id, hash string) error
}

type hasher interface {
	Hash(ctx context.Context, password string) (string, error)
	Verify(ctx context.Context, password, encoded string) (ok, rehash bool, err error)
}

type sessionReplacer interface {
	Replace(ctx context.Context, w http.ResponseWriter, r *http.Request, userID string) (sessions.Session, error)
}

// Handler serves the POST /api/sessions endpoint.
type Handler struct {
	store     userStore
	hasher    hasher
	dummyHash string
	sessions  sessionReplacer
	bind      func(r *http.Request, i any) error
	validate  func(req request) error
}

// Deps are what a Handler uses. DummyHash is a hash of a password nobody
// knows, made with the hasher's parameters, which a login for an unknown
// email verifies so that it takes as long as one for a known email.
type Deps struct {
	Store     userStore
	Hasher    hasher
	DummyHash string
	Sessions  sessionReplacer
}

// NewHandler returns a Handler that uses d.
func NewHandler(d Deps) *Handler {
	return &Handler{
		store:     d.Store,
		hasher:    d.Hasher,
		dummyHash: d.DummyHash,
		sessions:  d.Sessions,
		bind:      bind,
		validate:  validate,
	}
}

// Handle logs a user in. It canonicalizes the JSON email and password and checks only that both are present and not too long
// (400). An unknown email and a wrong password both get 401
// invalid_credentials, and both verify a hash, the unknown email against
// the dummy hash. On success it
// rehashes a password whose hash has outdated parameters, replaces the
// session the request carried with a new one and responds 201 with the
// session, its URL in Location and the session cookie.
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

	u, err := h.store.FindByEmail(ctx, req.Email)
	known := err == nil
	if err != nil && !errors.Is(err, kit.ErrNotFound) {
		return err
	}
	encoded := h.dummyHash
	if known {
		encoded = u.PasswordHash
	}
	ok, rehash, err := h.hasher.Verify(ctx, req.Password, encoded)
	if err != nil {
		return err
	}
	if !known || !ok {
		return httpkit.ErrInvalidCredentials
	}

	if rehash {
		h.rehash(ctx, u.ID, req.Password)
	}

	s, err := h.sessions.Replace(ctx, w, r, u.ID)
	if err != nil {
		return err
	}

	w.Header().Set("Location", domain.CurrentSessionPath)
	return httpkit.JSON(w, http.StatusCreated, response{
		ID:        s.ID,
		ExpiresAt: s.ExpiresAt.UTC(),
		User:      userResponse{ID: u.ID, Email: u.Email},
	})
}

// rehash stores a new hash of password under the current parameters. A
// failure only logs: the login has succeeded, and the next one tries again.
func (h *Handler) rehash(ctx context.Context, userID, password string) {
	hash, err := h.hasher.Hash(ctx, password)
	if err == nil {
		err = h.store.UpdatePasswordHash(ctx, userID, hash)
	}
	if err != nil {
		slog.WarnContext(ctx, "Rehashing a password failed", "error", err)
	}
}

func bind(r *http.Request, i any) error {
	return httpkit.BindJSON(r, i)
}

func validate(req request) error {
	return errors.Join(
		domain.ValidateLoginEmail(req.Email),
		domain.ValidateLoginPassword(req.Password),
	)
}

func sanitize(req *request) {
	req.Email = domain.CanonicalEmail(req.Email)
	req.Password = domain.CanonicalPassword(req.Password)
}

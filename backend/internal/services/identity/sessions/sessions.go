// Package sessions issues and resolves the identity service's cookie
// sessions (ADR 0047). A session's token is 32 random bytes, sent to the
// browser in the session cookie as base64url without padding; the Store keeps
// only its SHA-256 hash. The endpoints use a Manager; the Store behind it is
// replaceable.
package sessions

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/kit/authn"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
)

// tokenBytes is the size of a session token before encoding.
const tokenBytes = 32

var tokenEncoding = base64.RawURLEncoding.Strict()

// Manager starts sessions and resolves the session a request carries, under a
// SessionPolicy and a clock.
type Manager struct {
	store  Store
	policy domain.SessionPolicy
	now    func() time.Time
}

// NewManager returns a Manager that keeps sessions in store, expiring them by
// policy on the system clock.
func NewManager(store Store, policy domain.SessionPolicy) *Manager {
	return &Manager{store: store, policy: policy, now: time.Now}
}

// Start creates a session for userID and sets its cookie on w.
func (m *Manager) Start(ctx context.Context, w http.ResponseWriter, userID string) (Session, error) {
	token, hash := newToken()
	now := m.now()
	s, err := m.store.Create(ctx, NewSession{
		UserID:     userID,
		TokenHash:  hash,
		LastSeenAt: now,
		ExpiresAt:  m.policy.ExpiresAt(now, now),
	})
	if err != nil {
		return Session{}, err
	}
	http.SetCookie(w, m.cookie(token))
	return s, nil
}

// Replace deletes the session r carries, valid or not, then starts a new one
// for userID, so a token planted before a login is worthless after it.
func (m *Manager) Replace(ctx context.Context, w http.ResponseWriter, r *http.Request, userID string) (Session, error) {
	if hash, ok := carriedTokenHash(r); ok {
		if err := m.store.Delete(ctx, hash); err != nil {
			return Session{}, err
		}
	}
	return m.Start(ctx, w, userID)
}

// Authenticate returns middleware that resolves the session cookie: for a
// valid session, it records the use (at most once per touch interval, which
// extends the idle timeout) and passes on a request whose context carries the
// user's ID for authn.UserID. A missing, malformed, unknown or expired cookie
// leaves the request anonymous; routes that need a user wrap their handler
// in authn.Require. Storage failures go to onError.
func (m *Manager) Authenticate(onError httpkit.ErrorHandler) httpkit.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := m.resolve(r)
			if err != nil {
				onError(w, r, err)
				return
			}
			if userID != "" {
				r = r.WithContext(authn.WithUserID(r.Context(), userID))
			}
			next.ServeHTTP(w, r)
		})
	}
}

// resolve returns the user of the valid session r carries, or "" for none.
func (m *Manager) resolve(r *http.Request) (string, error) {
	hash, ok := carriedTokenHash(r)
	if !ok {
		return "", nil
	}
	ctx := r.Context()
	now := m.now()
	s, err := m.store.FindValid(ctx, hash, now)
	if errors.Is(err, kit.ErrNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if !m.policy.NeedsTouch(s.LastSeenAt, now) {
		return s.UserID, nil
	}
	expiresAt := m.policy.ExpiresAt(s.CreatedAt, now)
	if !expiresAt.After(now) {
		// At its absolute limit: expired, whatever the stored expiry says.
		return "", nil
	}
	if err := m.store.Touch(ctx, s.ID, now, expiresAt); err != nil {
		return "", err
	}
	return s.UserID, nil
}

// cookie returns the session cookie carrying token. Max-Age is the absolute
// timeout: no session outlives it, and the server decides earlier expiry.
func (m *Manager) cookie(token string) *http.Cookie {
	return &http.Cookie{
		Name:     domain.SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(m.policy.AbsoluteTimeout / time.Second),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
}

// newToken returns a new session token and its hash.
func newToken() (string, []byte) {
	b := make([]byte, tokenBytes)
	_, _ = rand.Read(b) // Never fails; see crypto/rand.Read.
	sum := sha256.Sum256(b)
	return tokenEncoding.EncodeToString(b), sum[:]
}

// carriedTokenHash returns the hash of the token in r's session cookie, and
// false when r has no cookie or its value isn't a token newToken could have
// made.
func carriedTokenHash(r *http.Request) ([]byte, bool) {
	c, err := r.Cookie(domain.SessionCookieName)
	if err != nil {
		return nil, false
	}
	return tokenHash(c.Value)
}

func tokenHash(token string) ([]byte, bool) {
	b, err := tokenEncoding.DecodeString(token)
	// The decoder skips line breaks, so the token must re-encode to itself.
	if err != nil || len(b) != tokenBytes || tokenEncoding.EncodeToString(b) != token {
		return nil, false
	}
	sum := sha256.Sum256(b)
	return sum[:], true
}

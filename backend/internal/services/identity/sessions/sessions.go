// Package sessions issues the identity service's cookie sessions (ADR 0047). A session's token is 32 random bytes, sent to the
// browser in the session cookie as base64url without padding; the Store keeps
// only its SHA-256 hash. The endpoints use a Manager; the Store behind it is
// replaceable.
package sessions

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"time"

	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
)

// tokenBytes is the size of a session token before encoding.
const tokenBytes = 32

var tokenEncoding = base64.RawURLEncoding.Strict()

// Manager starts sessions under a SessionPolicy and a clock.
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

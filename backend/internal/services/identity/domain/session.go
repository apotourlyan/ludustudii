package domain

import (
	"errors"
	"fmt"
	"time"
)

// SessionCookieName is the cookie that carries the session token. The
// __Host- prefix makes browsers accept it only with Secure, Path=/ and no
// Domain, so no subdomain can set it.
const SessionCookieName = "__Host-session"

// SessionPolicy decides when a session expires: IdleTimeout after its last
// use, and no later than AbsoluteTimeout after its creation.
type SessionPolicy struct {
	IdleTimeout     time.Duration
	AbsoluteTimeout time.Duration
}

// Validate reports every duration that isn't positive.
func (p SessionPolicy) Validate() error {
	var errs []error
	for name, d := range map[string]time.Duration{
		"idle timeout":     p.IdleTimeout,
		"absolute timeout": p.AbsoluteTimeout,
	} {
		if d <= 0 {
			errs = append(errs, fmt.Errorf("session %s must be positive, got %v", name, d))
		}
	}
	return errors.Join(errs...)
}

// ExpiresAt returns when a session created at createdAt and last used at
// lastSeenAt expires.
func (p SessionPolicy) ExpiresAt(createdAt, lastSeenAt time.Time) time.Time {
	idle := lastSeenAt.Add(p.IdleTimeout)
	absolute := createdAt.Add(p.AbsoluteTimeout)
	if idle.Before(absolute) {
		return idle
	}
	return absolute
}

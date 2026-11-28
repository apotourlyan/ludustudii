package domain

import (
	"errors"
	"fmt"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit/password"
)

// Config is the identity service's configuration. It is defined here rather
// than in package identity so tests build it without importing the
// endpoints.
type Config struct {
	// Password holds the argon2id parameters of new hashes. Hashes with other
	// parameters are replaced at the next successful login.
	Password password.Params
	// HashConcurrency caps the hashes computed at once.
	HashConcurrency int
	// Session decides when sessions expire.
	Session SessionPolicy
	// SessionCleanupInterval is how often expired sessions are deleted.
	SessionCleanupInterval time.Duration
}

// Validate reports every invalid setting.
func (c Config) Validate() error {
	errs := []error{c.Password.Validate(), c.Session.Validate()}
	if c.HashConcurrency < 1 {
		errs = append(errs, fmt.Errorf("hash concurrency must be at least 1, got %d", c.HashConcurrency))
	}
	if c.SessionCleanupInterval <= 0 {
		errs = append(errs, fmt.Errorf("session cleanup interval must be positive, got %v", c.SessionCleanupInterval))
	}
	return errors.Join(errs...)
}

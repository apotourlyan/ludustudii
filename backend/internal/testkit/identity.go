package testkit

import (
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit/password"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
)

// IdentityConfig returns the identity configuration for tests: hashing
// parameters cheap enough to keep tests fast, and the production session
// times.
func IdentityConfig() domain.Config {
	return domain.Config{
		Password:        password.Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32},
		HashConcurrency: 8,
		Session: domain.SessionPolicy{
			IdleTimeout:     7 * 24 * time.Hour,
			AbsoluteTimeout: 30 * 24 * time.Hour,
		},
	}
}

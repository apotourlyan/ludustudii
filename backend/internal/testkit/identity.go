package testkit

import (
	"github.com/apotourlyan/ludustudii/internal/kit/password"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
)

// IdentityConfig returns the identity configuration for tests, with hashing
// parameters cheap enough to keep tests fast.
func IdentityConfig() domain.Config {
	return domain.Config{
		Password: password.Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32},
	}
}

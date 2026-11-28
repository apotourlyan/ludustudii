package domain

import (
	"github.com/apotourlyan/ludustudii/internal/kit/password"
)

// Config is the identity service's configuration. It is defined here rather
// than in package identity so tests build it without importing the
// endpoints.
type Config struct {
	// Password holds the argon2id parameters of new hashes. Hashes with other
	// parameters are replaced at the next successful login.
	Password password.Params
}

// Validate reports every invalid setting.
func (c Config) Validate() error {
	return c.Password.Validate()
}

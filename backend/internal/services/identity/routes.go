// Package identity provides accounts (ADR 0046). Each endpoint lives in its
// own subpackage with a Handler and a Store; rules and configuration are in
// domain.
//
// Other services never import this package.
package identity

import (
	"database/sql"
	"fmt"

	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/kit/password"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
	"github.com/apotourlyan/ludustudii/internal/services/identity/register"
)

// Config is the identity service's configuration (see domain.Config).
type Config = domain.Config

// Service is the identity service's routes.
type Service struct {
	register *register.Handler
}

// New builds the identity service on db, after validating cfg.
func New(db *sql.DB, cfg Config) (*Service, error) {
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("identity config: %w", err)
	}
	hasher, err := password.NewHasher(cfg.Password, cfg.HashConcurrency)
	if err != nil {
		return nil, err
	}
	return &Service{
		register: register.NewHandler(register.NewStore(db), hasher),
	}, nil
}

// RegisterRoutes registers the identity endpoints:
//
//	POST /api/users  register (register)
func (s *Service) RegisterRoutes(api *httpkit.API) {
	api.HandleFunc("POST "+domain.UsersPath, s.register.Handle)
}

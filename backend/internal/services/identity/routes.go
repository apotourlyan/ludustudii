// Package identity provides accounts and sessions (ADRs 0046 to 0048). Each
// endpoint lives in its own subpackage with a Handler and, where it reads or
// writes users, a Store; sessions holds the session machinery the endpoints
// share; rules, limits and configuration are in domain.
//
// Other services never import this package.
package identity

import (
	"crypto/rand"
	"database/sql"
	"fmt"

	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/kit/password"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
	"github.com/apotourlyan/ludustudii/internal/services/identity/login"
	"github.com/apotourlyan/ludustudii/internal/services/identity/register"
	"github.com/apotourlyan/ludustudii/internal/services/identity/sessions"
)

// Config is the identity service's configuration (see domain.Config).
type Config = domain.Config

// SessionPolicy decides when sessions expire (see domain.SessionPolicy).
type SessionPolicy = domain.SessionPolicy

// Service is the identity service's routes.
type Service struct {
	register *register.Handler
	login    *login.Handler
}

// New builds the identity service on db. It validates cfg and hashes a
// random password once with cfg's parameters, for logins of unknown emails
// to verify.
func New(db *sql.DB, cfg Config) (*Service, error) {
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("identity config: %w", err)
	}
	hasher, err := password.NewHasher(cfg.Password, cfg.HashConcurrency)
	if err != nil {
		return nil, err
	}
	dummyHash, err := password.Hash(rand.Text(), cfg.Password)
	if err != nil {
		return nil, err
	}
	sm := sessions.NewManager(sessions.NewPostgres(db), cfg.Session)
	return &Service{
		register: register.NewHandler(register.NewStore(db), hasher, sm),
		login: login.NewHandler(login.Deps{
			Store:     login.NewStore(db),
			Hasher:    hasher,
			DummyHash: dummyHash,
			Sessions:  sm,
		}),
	}, nil
}

// RegisterRoutes registers the identity endpoints:
//
//	POST /api/users     register and log in (register)
//	POST /api/sessions  log in (login)
func (s *Service) RegisterRoutes(api *httpkit.API) {
	api.HandleFunc("POST "+domain.UsersPath, s.register.Handle)
	api.HandleFunc("POST "+domain.SessionsPath, s.login.Handle)
}

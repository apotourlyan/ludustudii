// Package identity provides accounts and sessions (ADRs 0046 to 0048). Each
// endpoint lives in its own subpackage with a Handler and, where it reads or
// writes users, a Store; sessions holds the session machinery the endpoints
// share; rules, limits and configuration are in domain.
//
// Other services never import this package: they read the authenticated
// user through kit/authn, which the middleware from Authenticate fills in.
package identity

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit/authn"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/kit/password"
	"github.com/apotourlyan/ludustudii/internal/kit/ratelimit"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
	"github.com/apotourlyan/ludustudii/internal/services/identity/login"
	"github.com/apotourlyan/ludustudii/internal/services/identity/logout"
	"github.com/apotourlyan/ludustudii/internal/services/identity/me"
	"github.com/apotourlyan/ludustudii/internal/services/identity/register"
	"github.com/apotourlyan/ludustudii/internal/services/identity/sessions"
)

// Config is the identity service's configuration (see domain.Config).
type Config = domain.Config

// SessionPolicy decides when sessions expire (see domain.SessionPolicy).
type SessionPolicy = domain.SessionPolicy

// Service is the identity service: its routes, the middleware that
// authenticates API requests, and the cleanup of expired sessions.
type Service struct {
	sessions        *sessions.Manager
	cleanupInterval time.Duration
	register        *register.Handler
	login           *login.Handler
	logout          *logout.Handler
	me              *me.Handler
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
		sessions:        sm,
		cleanupInterval: cfg.SessionCleanupInterval,
		register:        register.NewHandler(register.NewStore(db), hasher, sm, ratelimit.NewKeyed(cfg.RegisterIPLimit)),
		login: login.NewHandler(login.Deps{
			Store:        login.NewStore(db),
			Hasher:       hasher,
			DummyHash:    dummyHash,
			Sessions:     sm,
			IPLimit:      ratelimit.NewKeyed(cfg.LoginIPLimit),
			AccountLimit: ratelimit.NewKeyed(cfg.LoginAccountLimit),
		}),
		logout: logout.NewHandler(sm),
		me:     me.NewHandler(me.NewStore(db)),
	}, nil
}

// RegisterRoutes registers the identity endpoints:
//
//	POST   /api/users            register and log in (register)
//	GET    /api/users/me         the current user (me), with a session only
//	POST   /api/sessions         log in (login)
//	DELETE /api/sessions/current log out (logout)
//
// GET also serves HEAD.
func (s *Service) RegisterRoutes(api *httpkit.API) {
	api.HandleFunc("POST "+domain.UsersPath, s.register.Handle)
	api.HandleFunc("GET "+domain.CurrentUserPath, authn.Require(s.me.Handle))
	api.HandleFunc("POST "+domain.SessionsPath, s.login.Handle)
	api.HandleFunc("DELETE "+domain.CurrentSessionPath, s.logout.Handle)
}

// Authenticate returns the middleware that resolves the session cookie of
// every API request into the user for authn.UserID, reporting storage
// failures to onError (see sessions.Manager.Authenticate).
func (s *Service) Authenticate(onError httpkit.ErrorHandler) httpkit.Middleware {
	return s.sessions.Authenticate(onError)
}

// CleanupSessions deletes expired sessions at the configured interval until
// ctx ends. Run it for the server's lifetime.
func (s *Service) CleanupSessions(ctx context.Context) {
	s.sessions.Cleanup(ctx, s.cleanupInterval)
}

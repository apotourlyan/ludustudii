package app

import (
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/apotourlyan/ludustudii/internal/app/api"
	"github.com/apotourlyan/ludustudii/internal/app/router"
	"github.com/apotourlyan/ludustudii/internal/infra/apidocs"
	"github.com/apotourlyan/ludustudii/internal/infra/health"
	"github.com/apotourlyan/ludustudii/internal/infra/spa"
	"github.com/apotourlyan/ludustudii/internal/services/identity"
)

// parts are what this binary serves. Run loads them from the environment;
// tests build them directly.
type parts struct {
	db        *sql.DB
	identity  identity.Config
	readiness *health.State
	clientApp *spa.ClientApp
	docs      *apidocs.Docs // nil when the API reference is disabled
}

// newHandler builds each surface and mounts it on the shared router. Each
// surface owns its patterns and depends only on its own parts:
//
//	/livez, /readyz   probes (health), readiness state only
//	/api, /api/...    JSON API (api), database and identity configuration
//	GET /docs/...     API reference (apidocs), only when enabled
//	/                 client app catch-all (spa), embedded files only
//
// Middleware errors use the JSON error shape on every surface.
func newHandler(log *slog.Logger, p parts) (http.Handler, error) {
	onError := router.ErrorHandler(log)
	apiSurface, err := api.New(p.db, p.identity, onError)
	if err != nil {
		return nil, fmt.Errorf("build API: %w", err)
	}
	surfaces := []router.Surface{
		health.NewProbes(p.readiness, onError),
		apiSurface,
	}
	if p.docs != nil {
		surfaces = append(surfaces, apidocs.NewHandler(p.docs))
	}
	surfaces = append(surfaces, spa.NewHandler(p.clientApp, onError))
	return router.New(log, onError, surfaces...), nil
}

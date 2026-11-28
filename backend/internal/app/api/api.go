// Package api is the JSON API surface: every service's routes under Prefix,
// served by one httpkit.API that answers unknown paths and methods with the
// shared error shape. It needs only the database. It serves no probes and no
// client app, so it can be mounted alone. A new service registers in New.
package api

import (
	"database/sql"
	"net/http"

	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
	"github.com/apotourlyan/ludustudii/internal/services/lcards"
)

// Prefix is the path every API route lives under.
const Prefix = "/api"

// Surface routes every path under Prefix to the services' API.
type Surface struct {
	handler http.Handler
}

// New registers every service's routes on one API, reporting handler errors
// to onError. Every response is Cache-Control: no-store, and unsafe requests
// from other origins get 403 cross_origin_request.
func New(db *sql.DB, onError httpkit.ErrorHandler) *Surface {
	api := httpkit.NewAPI(onError)
	lcards.RegisterRoutes(api, db)
	return &Surface{
		handler: httpkit.Chain(
			httpkit.NoStore(),
			httpkit.CrossOriginProtection(onError),
		)(api),
	}
}

// Mount sends every path under Prefix to the API, which answers unknown paths
// and methods with JSON rather than leaving them to another surface. Both
// patterns are needed, or the mux redirects Prefix to Prefix+"/".
func (s *Surface) Mount(mux *http.ServeMux) {
	mux.Handle(Prefix, s.handler)
	mux.Handle(Prefix+"/", s.handler)
}

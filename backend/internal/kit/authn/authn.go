// Package authn carries the authenticated user through a request. The
// identity service's middleware resolves the session and calls WithUserID;
// services read the user with UserID, never through identity, and pass it on
// explicitly. Routes that need a user are wrapped in Require.
package authn

import (
	"context"
	"net/http"

	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
)

type userIDKey struct{}

// WithUserID returns a copy of ctx that carries the authenticated user's ID.
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey{}, userID)
}

// UserID returns the authenticated user's ID from ctx, and false for an
// anonymous request.
func UserID(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(userIDKey{}).(string)
	return id, ok && id != ""
}

// Require wraps h so it runs only for an authenticated request; any other
// gets 401 unauthenticated, without a WWW-Authenticate header, since cookie
// sessions have no registered scheme.
func Require(h httpkit.HandlerFunc) httpkit.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		if _, ok := UserID(r.Context()); !ok {
			return httpkit.ErrUnauthenticated
		}
		return h(w, r)
	}
}

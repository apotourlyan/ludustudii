//go:build unit

package httpkit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit/erresp"
)

// Route middleware runs after the mux matched, so the request a middleware
// replaces still carries the pattern on the request the caller passed in,
// and unmatched requests skip it.
func TestAPI_RouteMiddleware(t *testing.T) {
	t.Parallel()

	type key struct{}
	var order []string
	mark := func(name string) Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), key{}, name)))
			})
		}
	}
	var seen any
	api := NewAPI(func(w http.ResponseWriter, _ *http.Request, err error) {
		w.WriteHeader(StatusCode(err))
	}, mark("outer"), mark("inner"))
	api.HandleFunc("GET /items/{id}", func(w http.ResponseWriter, r *http.Request) error {
		seen = r.Context().Value(key{})
		return NoContent(w, http.StatusNoContent)
	})

	r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/items/1", nil)
	api.ServeHTTP(httptest.NewRecorder(), r)
	if r.Pattern != "GET /items/{id}" {
		t.Errorf("pattern on the caller's request: got %q", r.Pattern)
	}
	if seen != "inner" || len(order) != 2 || order[0] != "outer" || order[1] != "inner" {
		t.Errorf("middleware: order %v, handler saw %v", order, seen)
	}

	order = nil
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/nope", nil))
	if rec.Code != http.StatusNotFound || len(order) != 0 {
		t.Errorf("unmatched request: status %d, middleware %v", rec.Code, order)
	}
}

func TestTooManyRequests(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		retryAfter time.Duration
		want       string
	}{
		{0, "1"},
		{time.Millisecond, "1"},
		{time.Second, "1"},
		{time.Second + time.Nanosecond, "2"},
		{3333 * time.Millisecond, "4"},
		{15 * time.Minute, "900"},
	} {
		err := TooManyRequests(tt.retryAfter)
		se, ok := errors.AsType[*StatusError](err)
		if !ok || se.Code != http.StatusTooManyRequests || se.Response.Code != erresp.CodeTooManyRequests {
			t.Fatalf("%v: got %#v", tt.retryAfter, err)
		}
		if got := se.Header.Get("Retry-After"); got != tt.want {
			t.Errorf("%v: Retry-After %q, want %q", tt.retryAfter, got, tt.want)
		}
	}
}

func TestClientIP(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct{ remote, want string }{
		{"192.0.2.1:1234", "192.0.2.1"},
		{"[2001:db8::1]:443", "2001:db8::1"},
		{"192.0.2.1", "192.0.2.1"},
		{"", ""},
	} {
		r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
		r.RemoteAddr = tt.remote
		r.Header.Set("X-Forwarded-For", "203.0.113.9")
		if got := ClientIP(r); got != tt.want {
			t.Errorf("ClientIP(%q): got %q, want %q", tt.remote, got, tt.want)
		}
	}
}

func TestNoStore(t *testing.T) {
	t.Parallel()

	h := NoStore()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil))
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("Cache-Control: got %q, want no-store", got)
	}
}

func TestCrossOriginProtection(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name    string
		method  string
		headers map[string]string
		denied  bool
	}{
		{"same origin", http.MethodPost, map[string]string{"Sec-Fetch-Site": "same-origin"}, false},
		{"typed into the address bar", http.MethodPost, map[string]string{"Sec-Fetch-Site": "none"}, false},
		{"no browser headers", http.MethodDelete, nil, false},
		{"cross-site POST", http.MethodPost, map[string]string{"Sec-Fetch-Site": "cross-site"}, true},
		{"same-site PUT", http.MethodPut, map[string]string{"Sec-Fetch-Site": "same-site"}, true},
		{"cross-site PATCH", http.MethodPatch, map[string]string{"Sec-Fetch-Site": "cross-site"}, true},
		{"cross-site DELETE", http.MethodDelete, map[string]string{"Sec-Fetch-Site": "cross-site"}, true},
		{"other Origin without Sec-Fetch-Site", http.MethodPost, map[string]string{"Origin": "https://evil.example"}, true},
		{"matching Origin without Sec-Fetch-Site", http.MethodPost, map[string]string{"Origin": "http://example.com"}, false},
		{"cross-site GET", http.MethodGet, map[string]string{"Sec-Fetch-Site": "cross-site"}, false},
		{"cross-site HEAD", http.MethodHead, map[string]string{"Sec-Fetch-Site": "cross-site"}, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var gotErr error
			reached := false
			h := CrossOriginProtection(func(w http.ResponseWriter, _ *http.Request, err error) {
				gotErr = err
				w.WriteHeader(StatusCode(err))
			})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				reached = true
				w.WriteHeader(http.StatusNoContent)
			}))
			r := httptest.NewRequestWithContext(t.Context(), tt.method, "http://example.com/api/x", nil)
			for k, v := range tt.headers {
				r.Header.Set(k, v)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, r)

			if tt.denied {
				if reached || rec.Code != http.StatusForbidden || !errors.Is(gotErr, ErrCrossOriginRequest) {
					t.Errorf("got status %d, reached %v, error %v; want 403 cross_origin_request", rec.Code, reached, gotErr)
				}
				return
			}
			if !reached || rec.Code != http.StatusNoContent || gotErr != nil {
				t.Errorf("got status %d, reached %v, error %v; want it passed", rec.Code, reached, gotErr)
			}
		})
	}
}

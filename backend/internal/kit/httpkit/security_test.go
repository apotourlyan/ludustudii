//go:build unit

package httpkit

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

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

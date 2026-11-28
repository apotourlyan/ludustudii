//go:build integration

package app

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/apotourlyan/ludustudii/apispec"
	"github.com/apotourlyan/ludustudii/internal/infra/health"
	"github.com/apotourlyan/ludustudii/internal/infra/spa"
	"github.com/apotourlyan/ludustudii/internal/testkit"
	"github.com/getkin/kin-openapi/openapi3"
)

// These tests read the operations from the spec rather than list routes, so
// a new operation is covered without editing them.

type specOperation struct {
	method, path string
	op           *openapi3.Operation
}

func specOperations(t *testing.T) (*openapi3.T, []specOperation) {
	t.Helper()
	doc, err := apispec.Load()
	if err != nil {
		t.Fatal(err)
	}
	var ops []specOperation
	for path, item := range doc.Paths.Map() {
		for method, op := range item.Operations() {
			ops = append(ops, specOperation{method: method, path: path, op: op})
		}
	}
	slices.SortFunc(ops, func(a, b specOperation) int {
		return strings.Compare(a.method+" "+a.path, b.method+" "+b.path)
	})
	return doc, ops
}

// requiresSession reports whether every security alternative of op names
// sessionCookie, so a request without it can't satisfy any of them.
func requiresSession(doc *openapi3.T, op *openapi3.Operation) bool {
	reqs := doc.Security
	if op.Security != nil {
		reqs = *op.Security
	}
	if len(reqs) == 0 {
		return false
	}
	for _, alternative := range reqs {
		if _, ok := alternative["sessionCookie"]; !ok {
			return false
		}
	}
	return true
}

var pathParam = regexp.MustCompile(`\{[^}]+\}`)

// concretePath fills every path parameter with a valid UUIDv7, the only kind
// of parameter the API has.
func concretePath(path string) string {
	return pathParam.ReplaceAllString(path, "019a0000-0000-7000-8000-000000000001")
}

func newSpecServer(t *testing.T) *httptest.Server {
	t.Helper()
	clientApp, err := spa.Load()
	if err != nil {
		t.Fatal(err)
	}
	log := discardLogger()
	db := testkit.NewDB(t)
	srv := httptest.NewServer(newIntegrationHandler(t, log, parts{db: db, readiness: health.NewState(log, db), clientApp: clientApp}))
	t.Cleanup(srv.Close)
	return srv
}

func requestBody(op *openapi3.Operation) (contentType, body string) {
	if op.RequestBody == nil {
		return "", ""
	}
	return "application/json", "{}"
}

func TestSpec_SessionOperationsAnswerUnauthenticated(t *testing.T) {
	t.Parallel()
	doc, ops := specOperations(t)
	srv := newSpecServer(t)

	covered := 0
	for _, o := range ops {
		if !requiresSession(doc, o.op) {
			continue
		}
		covered++
		t.Run(o.method+" "+o.path, func(t *testing.T) {
			t.Parallel()
			contentType, body := requestBody(o.op)
			resp := testkit.Do(t, srv, testkit.DoOpts{
				Method: o.method, Path: concretePath(o.path), ContentType: contentType, Body: body,
			})
			testkit.AssertStatus(t, resp, http.StatusUnauthorized)
			if o.method != http.MethodHead {
				testkit.AssertJSON(t, resp.Body, `{"code":"unauthenticated"}`)
			}
			if v := resp.Header.Get("WWW-Authenticate"); v != "" {
				t.Errorf("WWW-Authenticate: got %q, want none", v)
			}
		})
	}
	if covered == 0 {
		t.Fatal("no operation in the spec requires sessionCookie")
	}
}

func TestSpec_UnsafeOperationsRejectCrossOrigin(t *testing.T) {
	t.Parallel()
	_, ops := specOperations(t)
	srv := newSpecServer(t)

	unsafe := []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete}
	covered := 0
	for _, o := range ops {
		if !slices.Contains(unsafe, o.method) {
			continue
		}
		covered++
		t.Run(o.method+" "+o.path, func(t *testing.T) {
			t.Parallel()
			contentType, body := requestBody(o.op)
			for _, headers := range []http.Header{
				{"Sec-Fetch-Site": {"cross-site"}},
				{"Sec-Fetch-Site": {"same-site"}},
				{"Origin": {"https://evil.example"}},
			} {
				resp := testkit.Do(t, srv, testkit.DoOpts{
					Method: o.method, Path: concretePath(o.path), ContentType: contentType, Body: body, Headers: headers,
				})
				testkit.AssertStatus(t, resp, http.StatusForbidden)
				testkit.AssertJSON(t, resp.Body, `{"code":"cross_origin_request"}`)
				if got := resp.Header.Get("Cache-Control"); got != "no-store" {
					t.Errorf("Cache-Control: got %q, want no-store", got)
				}
			}
		})
	}
	if covered == 0 {
		t.Fatal("no unsafe operation in the spec")
	}
}

// The same requests from the client app's own origin pass the check.
func TestSpec_UnsafeOperationsAllowSameOrigin(t *testing.T) {
	t.Parallel()
	_, ops := specOperations(t)
	srv := newSpecServer(t)

	for _, o := range ops {
		if o.method != http.MethodPost && o.method != http.MethodPut && o.method != http.MethodPatch && o.method != http.MethodDelete {
			continue
		}
		t.Run(o.method+" "+o.path, func(t *testing.T) {
			t.Parallel()
			contentType, body := requestBody(o.op)
			resp := testkit.Do(t, srv, testkit.DoOpts{
				Method: o.method, Path: concretePath(o.path), ContentType: contentType, Body: body,
				Headers: http.Header{"Sec-Fetch-Site": {"same-origin"}, "Origin": {srv.URL}},
			})
			if resp.StatusCode == http.StatusForbidden {
				t.Errorf("same-origin request rejected: %s", resp.Body)
			}
		})
	}
}

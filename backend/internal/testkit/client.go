package testkit

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

// DoOpts describes a request sent by Do. Path is appended to the server URL;
// empty ContentType and Body are not sent. Chunked sends Body without a
// Content-Length, using chunked transfer encoding. Headers are copied before
// ContentType is applied; a nonempty ContentType overrides that header.
// Cookies are added to the request's Cookie header, whatever their
// attributes, as a browser would send them.
type DoOpts struct {
	Method      string
	Path        string
	ContentType string
	Headers     http.Header
	Body        string
	Chunked     bool
	Cookies     []*http.Cookie
}

// Response contains the status, headers, and fully read body returned by Do.
type Response struct {
	StatusCode int
	Header     http.Header
	Body       []byte
}

// Cookie returns the cookie named name that the response set, or nil.
func (r Response) Cookie(name string) *http.Cookie {
	for _, c := range (&http.Response{Header: r.Header}).Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// Do sends the request described by o to s, with a 10-second timeout, without
// following redirects, validates the response against the OpenAPI
// specification, and returns its status, headers, and fully read body.
// The request itself is not validated, so tests can send invalid input.
// It fails the test if the request cannot be sent or the body cannot be read.
func Do(tb testing.TB, s *httptest.Server, o DoOpts) Response {
	tb.Helper()
	ctx, cancel := context.WithTimeout(tb.Context(), 10*time.Second)
	defer cancel()
	var r io.Reader
	if o.Body != "" {
		r = strings.NewReader(o.Body)
		if o.Chunked {
			// Hiding the reader's type stops NewRequest from setting ContentLength.
			r = io.MultiReader(r)
		}
	}
	req, err := http.NewRequestWithContext(ctx, o.Method, s.URL+o.Path, r)
	if err != nil {
		tb.Fatal(err)
	}
	if o.Headers != nil {
		req.Header = o.Headers.Clone()
	}
	if o.ContentType != "" {
		req.Header.Set("Content-Type", o.ContentType)
	}
	for _, c := range o.Cookies {
		req.AddCookie(c)
	}
	client := *s.Client()
	client.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	resp, err := client.Do(req)
	if err != nil {
		tb.Fatal(err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			tb.Errorf("close response: %v", err)
		}
	}()
	content, err := io.ReadAll(resp.Body)
	if err != nil {
		tb.Fatal(err)
	}
	ValidateResponse(tb, req, resp, content)
	return Response{
		StatusCode: resp.StatusCode,
		Header:     resp.Header,
		Body:       content,
	}
}

// AssertStatus fails the test unless resp has status code want. The failure
// message includes the response body.
func AssertStatus(t *testing.T, resp Response, want int) {
	t.Helper()
	if resp.StatusCode != want {
		t.Fatalf("status: got %d, want %d\n%s", resp.StatusCode, want, resp.Body)
	}
}

// AssertJSON compares JSON structurally against a literal, so the test pins
// the wire format (field names, [] vs null) instead of reusing handler types.
func AssertJSON(t *testing.T, got []byte, want string) {
	t.Helper()
	var g, w any
	if err := json.Unmarshal(got, &g); err != nil {
		t.Fatalf("response is not JSON: %v\n%s", err, got)
	}
	if err := json.Unmarshal([]byte(want), &w); err != nil {
		t.Fatalf("bad want literal: %v", err)
	}
	if !reflect.DeepEqual(g, w) {
		t.Errorf("body:\n got %s\nwant %s", got, want)
	}
}

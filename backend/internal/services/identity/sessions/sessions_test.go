//go:build unit

package sessions

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/kit/authn"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
)

const (
	day    = 24 * time.Hour
	userID = "019a0000-0000-7000-8000-0000000000aa"
)

var policy = domain.SessionPolicy{IdleTimeout: 7 * day, AbsoluteTimeout: 30 * day, TouchInterval: time.Minute}

var start = time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)

// clock is a fake clock that tests move by hand.
type clock struct{ now time.Time }

func (c *clock) Now() time.Time          { return c.now }
func (c *clock) Advance(d time.Duration) { c.now = c.now.Add(d) }

type touch struct {
	id                    string
	lastSeenAt, expiresAt time.Time
}

// memStore is a Store in memory, with the semantics of Postgres: FindValid
// returns only sessions that expire after now. The creation time is the
// clock's, standing in for the database's.
type memStore struct {
	mu       sync.Mutex
	clock    *clock
	sessions map[string]Session // by token hash
	touches  []touch
	deleted  [][]byte
	err      error // returned by every method when set
}

func newMemStore(c *clock) *memStore {
	return &memStore{clock: c, sessions: map[string]Session{}}
}

func (s *memStore) Create(_ context.Context, n NewSession) (Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return Session{}, s.err
	}
	out := Session{
		ID:         "019a0000-0000-7000-8000-" + strings.Repeat("0", 11) + string(rune('0'+len(s.sessions))),
		UserID:     n.UserID,
		LastSeenAt: n.LastSeenAt,
		ExpiresAt:  n.ExpiresAt,
		CreatedAt:  s.clock.Now(),
	}
	s.sessions[string(n.TokenHash)] = out
	return out, nil
}

func (s *memStore) FindValid(_ context.Context, hash []byte, now time.Time) (Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return Session{}, s.err
	}
	found, ok := s.sessions[string(hash)]
	if !ok || !found.ExpiresAt.After(now) {
		return Session{}, kit.ErrNotFound
	}
	return found, nil
}

func (s *memStore) Touch(_ context.Context, id string, lastSeenAt, expiresAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return s.err
	}
	s.touches = append(s.touches, touch{id, lastSeenAt, expiresAt})
	for hash, found := range s.sessions {
		if found.ID == id {
			found.LastSeenAt, found.ExpiresAt = lastSeenAt, expiresAt
			s.sessions[hash] = found
		}
	}
	return nil
}

func (s *memStore) Delete(_ context.Context, hash []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return s.err
	}
	s.deleted = append(s.deleted, hash)
	delete(s.sessions, string(hash))
	return nil
}

func (s *memStore) DeleteExpired(_ context.Context, now time.Time) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return 0, s.err
	}
	var n int64
	for hash, found := range s.sessions {
		if !found.ExpiresAt.After(now) {
			delete(s.sessions, hash)
			n++
		}
	}
	return n, nil
}

func newTestManager(t *testing.T) (*Manager, *memStore, *clock) {
	t.Helper()
	c := &clock{now: start}
	store := newMemStore(c)
	return &Manager{store: store, policy: policy, now: c.Now}, store, c
}

// startSession starts a session and returns its cookie.
func startSession(t *testing.T, m *Manager) *http.Cookie {
	t.Helper()
	rec := httptest.NewRecorder()
	if _, err := m.Start(t.Context(), rec, userID); err != nil {
		t.Fatalf("start: %v", err)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("cookies: got %d, want 1", len(cookies))
	}
	return cookies[0]
}

// authenticate sends a request with cookie (when not nil) through the
// middleware and returns the user it resolved and the error it reported.
func authenticate(t *testing.T, m *Manager, cookie *http.Cookie) (string, error) {
	t.Helper()
	var user string
	var reported error
	h := m.Authenticate(func(w http.ResponseWriter, _ *http.Request, err error) {
		reported = err
		w.WriteHeader(http.StatusInternalServerError)
	})(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		user, _ = authn.UserID(r.Context())
	}))
	r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/users/me", nil)
	if cookie != nil {
		r.AddCookie(cookie)
	}
	h.ServeHTTP(httptest.NewRecorder(), r)
	return user, reported
}

func TestManager_Start(t *testing.T) {
	t.Parallel()

	m, store, _ := newTestManager(t)
	rec := httptest.NewRecorder()
	s, err := m.Start(t.Context(), rec, userID)
	if err != nil {
		t.Fatal(err)
	}
	if s.UserID != userID || !s.LastSeenAt.Equal(start) || !s.ExpiresAt.Equal(start.Add(7*day)) {
		t.Errorf("session: got %+v, want last seen now and expiring after the idle timeout", s)
	}

	header := rec.Header().Get("Set-Cookie")
	for _, want := range []string{"__Host-session=", "Path=/", "Max-Age=2592000", "HttpOnly", "Secure", "SameSite=Lax"} {
		if !strings.Contains(header, want) {
			t.Errorf("Set-Cookie %q lacks %q", header, want)
		}
	}
	if strings.Contains(header, "Domain") {
		t.Errorf("Set-Cookie %q has a Domain, which __Host- forbids", header)
	}

	// The store keeps the SHA-256 of the 32 decoded bytes, never the token.
	token := rec.Result().Cookies()[0].Value
	raw, err := tokenEncoding.DecodeString(token)
	if err != nil || len(raw) != tokenBytes || len(token) != 43 {
		t.Fatalf("token %q: %d bytes, %v; want 32 bytes as 43 base64url characters", token, len(raw), err)
	}
	sum := sha256.Sum256(raw)
	if _, ok := store.sessions[string(sum[:])]; !ok {
		t.Error("store has no session under the token's hash")
	}
	if _, ok := store.sessions[token]; ok {
		t.Error("store has the token itself")
	}

	store.err = errors.New("boom")
	rec = httptest.NewRecorder()
	if _, err := m.Start(t.Context(), rec, userID); err == nil || rec.Header().Get("Set-Cookie") != "" {
		t.Errorf("store failure: got %v and Set-Cookie %q, want an error and no cookie", err, rec.Header().Get("Set-Cookie"))
	}
}

func TestNewToken_Unique(t *testing.T) {
	t.Parallel()

	seen := map[string]bool{}
	for range 100 {
		token, hash := newToken()
		if seen[token] {
			t.Fatalf("token repeated: %q", token)
		}
		seen[token] = true
		if got, ok := tokenHash(token); !ok || !bytes.Equal(got, hash) {
			t.Fatalf("tokenHash(%q) does not match newToken's hash", token)
		}
	}
}

func TestTokenHash_Malformed(t *testing.T) {
	t.Parallel()

	token, _ := newToken()
	for _, bad := range []string{
		"",
		"short",
		token[:42],
		token + "A",
		token[:42] + "=", // padding
		strings.Replace(token, token[:1], "+", 1), // standard alphabet
		token[:20] + "\n" + token[20:],            // the decoder skips line breaks
	} {
		if _, ok := tokenHash(bad); ok {
			t.Errorf("tokenHash(%q): accepted", bad)
		}
	}
}

func TestManager_Authenticate(t *testing.T) {
	t.Parallel()

	t.Run("no cookie is anonymous without a lookup", func(t *testing.T) {
		t.Parallel()
		m, store, _ := newTestManager(t)
		store.err = errors.New("must not be called")
		if user, err := authenticate(t, m, nil); user != "" || err != nil {
			t.Errorf("got %q, %v; want anonymous", user, err)
		}
	})

	t.Run("malformed cookie is anonymous without a lookup", func(t *testing.T) {
		t.Parallel()
		m, store, _ := newTestManager(t)
		store.err = errors.New("must not be called")
		cookie := &http.Cookie{Name: domain.SessionCookieName, Value: "not-a-token"}
		if user, err := authenticate(t, m, cookie); user != "" || err != nil {
			t.Errorf("got %q, %v; want anonymous", user, err)
		}
	})

	t.Run("unknown token is anonymous", func(t *testing.T) {
		t.Parallel()
		m, _, _ := newTestManager(t)
		token, _ := newToken()
		cookie := &http.Cookie{Name: domain.SessionCookieName, Value: token}
		if user, err := authenticate(t, m, cookie); user != "" || err != nil {
			t.Errorf("got %q, %v; want anonymous", user, err)
		}
	})

	t.Run("valid session puts its user in the context", func(t *testing.T) {
		t.Parallel()
		m, _, _ := newTestManager(t)
		cookie := startSession(t, m)
		if user, err := authenticate(t, m, cookie); user != userID || err != nil {
			t.Errorf("got %q, %v; want %q", user, err, userID)
		}
	})

	t.Run("storage failure is reported", func(t *testing.T) {
		t.Parallel()
		m, store, _ := newTestManager(t)
		cookie := startSession(t, m)
		store.err = errors.New("boom")
		if user, err := authenticate(t, m, cookie); user != "" || err == nil {
			t.Errorf("got %q, %v; want the store's error", user, err)
		}
	})

	t.Run("touch failure is reported", func(t *testing.T) {
		t.Parallel()
		m, store, c := newTestManager(t)
		cookie := startSession(t, m)
		c.Advance(time.Hour)
		failing := &failingTouch{memStore: store}
		m.store = failing
		if user, err := authenticate(t, m, cookie); user != "" || !errors.Is(err, errTouch) {
			t.Errorf("got %q, %v; want the touch error", user, err)
		}
	})
}

var errTouch = errors.New("touch failed")

type failingTouch struct{ *memStore }

func (f *failingTouch) Touch(context.Context, string, time.Time, time.Time) error { return errTouch }

// The last use is written at most once per touch interval, and each write
// moves the idle expiry.
func TestManager_TouchInterval(t *testing.T) {
	t.Parallel()

	m, store, c := newTestManager(t)
	cookie := startSession(t, m)

	for range 3 {
		c.Advance(20 * time.Second)
		if user, _ := authenticate(t, m, cookie); user != userID {
			t.Fatal("session lost within the touch interval")
		}
	}
	if len(store.touches) != 1 {
		// At 60s the interval has passed; at 20s and 40s it hadn't.
		t.Fatalf("touches after 1m: got %d, want 1 (%v)", len(store.touches), store.touches)
	}
	got := store.touches[0]
	if want := start.Add(time.Minute); !got.lastSeenAt.Equal(want) || !got.expiresAt.Equal(want.Add(7*day)) {
		t.Errorf("touch: got %+v, want last seen %v, expiring 7 days later", got, want)
	}

	c.Advance(59 * time.Second)
	_, _ = authenticate(t, m, cookie)
	if len(store.touches) != 1 {
		t.Errorf("touched again 59s after the last touch")
	}
	c.Advance(time.Second)
	_, _ = authenticate(t, m, cookie)
	if len(store.touches) != 2 {
		t.Errorf("not touched a minute after the last touch")
	}
}

func TestManager_IdleTimeout(t *testing.T) {
	t.Parallel()

	t.Run("unused, it expires after the idle timeout", func(t *testing.T) {
		t.Parallel()
		m, _, c := newTestManager(t)
		cookie := startSession(t, m)
		c.Advance(7 * day)
		if user, _ := authenticate(t, m, cookie); user != "" {
			t.Fatal("session valid 7 days after its creation, unused")
		}
	})

	t.Run("each use extends it", func(t *testing.T) {
		t.Parallel()
		m, _, c := newTestManager(t)
		cookie := startSession(t, m)
		for range 2 {
			c.Advance(7*day - time.Second)
			if user, _ := authenticate(t, m, cookie); user != userID {
				t.Fatalf("session lost a second before its idle expiry, at %v", c.Now().Sub(start))
			}
		}
		c.Advance(7 * day)
		if user, _ := authenticate(t, m, cookie); user != "" {
			t.Fatal("session valid 7 days after its last use")
		}
	})
}

func TestManager_AbsoluteTimeout(t *testing.T) {
	t.Parallel()

	m, store, c := newTestManager(t)
	cookie := startSession(t, m)

	// Used every day, a session still ends 30 days after its creation.
	for c.Now().Before(start.Add(29 * day)) {
		c.Advance(day)
		if user, _ := authenticate(t, m, cookie); user != userID {
			t.Fatalf("session lost after %v", c.Now().Sub(start))
		}
	}
	last := store.touches[len(store.touches)-1]
	if !last.expiresAt.Equal(start.Add(30 * day)) {
		t.Errorf("expiry near the absolute limit: got %v, want %v", last.expiresAt, start.Add(30*day))
	}
	c.Advance(day - time.Second)
	if user, _ := authenticate(t, m, cookie); user != userID {
		t.Fatal("session lost a second before its absolute limit")
	}
	c.Advance(time.Second)
	if user, _ := authenticate(t, m, cookie); user != "" {
		t.Fatal("session valid at its absolute limit")
	}
}

// A touch that would take a session to or past its absolute limit treats it
// as expired rather than storing an expiry that isn't in the future.
func TestManager_AbsoluteLimitBeforeStoredExpiry(t *testing.T) {
	t.Parallel()

	m, store, c := newTestManager(t)
	cookie := startSession(t, m)
	// A stored expiry past the absolute limit, as a clock difference between
	// the database and the server could leave it.
	for hash, s := range store.sessions {
		s.ExpiresAt = start.Add(31 * day)
		s.LastSeenAt = start.Add(29 * day)
		store.sessions[hash] = s
	}
	c.Advance(30 * day)
	if user, err := authenticate(t, m, cookie); user != "" || err != nil {
		t.Errorf("got %q, %v; want anonymous", user, err)
	}
	if len(store.touches) != 0 {
		t.Errorf("touched a session at its absolute limit: %v", store.touches)
	}
}

func TestManager_Replace(t *testing.T) {
	t.Parallel()

	m, store, _ := newTestManager(t)
	old := startSession(t, m)

	r := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/sessions", nil)
	r.AddCookie(old)
	rec := httptest.NewRecorder()
	if _, err := m.Replace(t.Context(), rec, r, userID); err != nil {
		t.Fatal(err)
	}
	if user, _ := authenticate(t, m, old); user != "" {
		t.Error("the replaced session still works")
	}
	fresh := rec.Result().Cookies()[0]
	if fresh.Value == old.Value {
		t.Fatal("replace reused the token")
	}
	if user, _ := authenticate(t, m, fresh); user != userID {
		t.Error("the new session doesn't work")
	}

	// Without a cookie, there is nothing to delete.
	store.deleted = nil
	r = httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/sessions", nil)
	if _, err := m.Replace(t.Context(), httptest.NewRecorder(), r, userID); err != nil {
		t.Fatal(err)
	}
	if len(store.deleted) != 0 {
		t.Errorf("deleted without a cookie: %v", store.deleted)
	}
}

func TestManager_End(t *testing.T) {
	t.Parallel()

	for _, withSession := range []bool{true, false} {
		m, store, _ := newTestManager(t)
		r := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/api/sessions/current", nil)
		var cookie *http.Cookie
		if withSession {
			cookie = startSession(t, m)
			r.AddCookie(cookie)
		}
		rec := httptest.NewRecorder()
		if err := m.End(t.Context(), rec, r); err != nil {
			t.Fatal(err)
		}
		header := rec.Header().Get("Set-Cookie")
		for _, want := range []string{"__Host-session=;", "Path=/", "Max-Age=0", "HttpOnly", "Secure", "SameSite=Lax"} {
			if !strings.Contains(header, want) {
				t.Errorf("with session %v: Set-Cookie %q lacks %q", withSession, header, want)
			}
		}
		if withSession {
			if user, _ := authenticate(t, m, cookie); user != "" {
				t.Error("the ended session still works")
			}
		} else if len(store.deleted) != 0 {
			t.Errorf("deleted without a cookie: %v", store.deleted)
		}
	}

	// A failed delete still expires the cookie.
	m, store, _ := newTestManager(t)
	r := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/api/sessions/current", nil)
	r.AddCookie(startSession(t, m))
	store.err = errors.New("boom")
	rec := httptest.NewRecorder()
	if err := m.End(t.Context(), rec, r); err == nil || !strings.Contains(rec.Header().Get("Set-Cookie"), "Max-Age=0") {
		t.Errorf("failed delete: got %v and Set-Cookie %q", err, rec.Header().Get("Set-Cookie"))
	}
}

// expiringStore reports each DeleteExpired call.
type expiringStore struct {
	*memStore
	calls chan time.Time
	err   error
}

func (s *expiringStore) DeleteExpired(_ context.Context, now time.Time) (int64, error) {
	s.calls <- now
	return 0, s.err
}

func TestManager_Cleanup(t *testing.T) {
	t.Parallel()

	for _, storeErr := range []error{nil, errors.New("boom")} {
		m, mem, _ := newTestManager(t)
		store := &expiringStore{memStore: mem, calls: make(chan time.Time, 10), err: storeErr}
		m.store = store

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan struct{})
		go func() {
			m.Cleanup(ctx, time.Millisecond)
			close(done)
		}()
		for range 3 {
			select {
			case now := <-store.calls:
				if !now.Equal(start) {
					t.Errorf("cleanup used %v, not the manager's clock", now)
				}
			case <-time.After(5 * time.Second):
				t.Fatal("cleanup didn't run")
			}
		}
		cancel()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Fatal("cleanup didn't stop when its context ended")
		}
	}
}

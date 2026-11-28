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
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
)

const (
	day    = 24 * time.Hour
	userID = "019a0000-0000-7000-8000-0000000000aa"
)

var policy = domain.SessionPolicy{IdleTimeout: 7 * day, AbsoluteTimeout: 30 * day}

var start = time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)

// clock is a fake clock that tests move by hand.
type clock struct{ now time.Time }

func (c *clock) Now() time.Time          { return c.now }
func (c *clock) Advance(d time.Duration) { c.now = c.now.Add(d) }

// memStore is a Store in memory, with the semantics of Postgres: FindValid
// returns only sessions that expire after now. The creation time is the
// clock's, standing in for the database's.
type memStore struct {
	mu       sync.Mutex
	clock    *clock
	sessions map[string]Session // by token hash
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

func newTestManager(t *testing.T) (*Manager, *memStore) {
	t.Helper()
	c := &clock{now: start}
	store := newMemStore(c)
	return &Manager{store: store, policy: policy, now: c.Now}, store
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

func TestManager_Start(t *testing.T) {
	t.Parallel()

	m, store := newTestManager(t)
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

func TestManager_Replace(t *testing.T) {
	t.Parallel()

	m, store := newTestManager(t)
	old := startSession(t, m)

	r := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/sessions", nil)
	r.AddCookie(old)
	rec := httptest.NewRecorder()
	if _, err := m.Replace(t.Context(), rec, r, userID); err != nil {
		t.Fatal(err)
	}
	if hash, _ := tokenHash(old.Value); store.sessions[string(hash)] != (Session{}) {
		t.Error("the replaced session is still stored")
	}
	fresh := rec.Result().Cookies()[0]
	if fresh.Value == old.Value {
		t.Fatal("replace reused the token")
	}
	if hash, _ := tokenHash(fresh.Value); store.sessions[string(hash)].UserID != userID {
		t.Error("the new session isn't stored")
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

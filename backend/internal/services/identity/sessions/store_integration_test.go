//go:build integration

package sessions

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/kit/validator"
	"github.com/apotourlyan/ludustudii/internal/testkit"
)

func TestMain(m *testing.M) {
	os.Exit(testkit.Run(m))
}

// insertUser adds a user directly, so the store tests don't depend on
// registration.
func insertUser(t *testing.T, db *sql.DB) string {
	t.Helper()
	var id string
	err := db.QueryRowContext(t.Context(),
		`INSERT INTO users (email, password_hash, created_at, updated_at)
		 VALUES ($1, '$argon2id$v=19$m=64,t=1,p=1$c29tZXNhbHQ$aGFzaGhhc2hoYXNoaGFzaA', now(), now())
		 RETURNING id`, "a@example.com",
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	return id
}

func hashOf(s string) []byte {
	sum := sha256.Sum256([]byte(s))
	return sum[:]
}

// The store's times have microsecond precision, as PostgreSQL's timestamptz.
var now = time.Date(2026, 11, 28, 9, 30, 0, 123456000, time.UTC)

func TestPostgres_CreateAndFind(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	store := NewPostgres(db)
	user := insertUser(t, db)

	created, err := store.Create(t.Context(), NewSession{
		UserID: user, TokenHash: hashOf("token"), LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := validator.UUID7("id", created.ID); err != nil {
		t.Errorf("id %q: %v", created.ID, err)
	}
	if created.CreatedAt.IsZero() {
		t.Error("no creation time")
	}

	found, err := store.FindValid(t.Context(), hashOf("token"), now)
	if err != nil {
		t.Fatal(err)
	}
	if found.ID != created.ID || found.UserID != user || !found.LastSeenAt.Equal(now) ||
		!found.ExpiresAt.Equal(now.Add(time.Hour)) || !found.CreatedAt.Equal(created.CreatedAt) {
		t.Errorf("found %+v, created %+v", found, created)
	}

	var stored []byte
	var createdAt, updatedAt time.Time
	if err := db.QueryRowContext(t.Context(),
		`SELECT token_hash, created_at, updated_at FROM sessions WHERE id = $1`, created.ID,
	).Scan(&stored, &createdAt, &updatedAt); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(stored, hashOf("token")) {
		t.Errorf("token_hash: got %x", stored)
	}
	if !createdAt.Equal(updatedAt) {
		t.Errorf("timestamps: created_at %v, updated_at %v; want equal", createdAt, updatedAt)
	}
}

func TestPostgres_FindValid(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	store := NewPostgres(db)
	user := insertUser(t, db)
	if _, err := store.Create(t.Context(), NewSession{
		UserID: user, TokenHash: hashOf("token"), LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
	}); err != nil {
		t.Fatal(err)
	}

	for _, tt := range []struct {
		name  string
		hash  []byte
		at    time.Time
		found bool
	}{
		{"before expiry", hashOf("token"), now.Add(time.Hour - time.Microsecond), true},
		{"at expiry", hashOf("token"), now.Add(time.Hour), false},
		{"after expiry", hashOf("token"), now.Add(2 * time.Hour), false},
		{"unknown token", hashOf("other"), now, false},
	} {
		_, err := store.FindValid(t.Context(), tt.hash, tt.at)
		if tt.found && err != nil {
			t.Errorf("%s: %v", tt.name, err)
		}
		if !tt.found && !errors.Is(err, kit.ErrNotFound) {
			t.Errorf("%s: got %v, want kit.ErrNotFound", tt.name, err)
		}
	}
}

func TestPostgres_Touch(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	store := NewPostgres(db)
	user := insertUser(t, db)
	s, err := store.Create(t.Context(), NewSession{
		UserID: user, TokenHash: hashOf("token"), LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
	})
	if err != nil {
		t.Fatal(err)
	}

	later := now.Add(30 * time.Minute)
	if err := store.Touch(t.Context(), s.ID, later, later.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	found, err := store.FindValid(t.Context(), hashOf("token"), now.Add(80*time.Minute))
	if err != nil {
		t.Fatalf("touched session not found past its old expiry: %v", err)
	}
	if !found.LastSeenAt.Equal(later) || !found.ExpiresAt.Equal(later.Add(time.Hour)) {
		t.Errorf("after touch: %+v", found)
	}

	var createdAt, updatedAt time.Time
	if err := db.QueryRowContext(t.Context(),
		`SELECT created_at, updated_at FROM sessions WHERE id = $1`, s.ID,
	).Scan(&createdAt, &updatedAt); err != nil {
		t.Fatal(err)
	}
	if !createdAt.Equal(s.CreatedAt) || updatedAt.Before(createdAt) {
		t.Errorf("timestamps: created_at %v (was %v), updated_at %v", createdAt, s.CreatedAt, updatedAt)
	}

	// Touching a deleted session changes nothing and isn't an error.
	if err := store.Touch(t.Context(), "019a0000-0000-7000-8000-000000000001", later, later.Add(time.Hour)); err != nil {
		t.Errorf("touch unknown session: %v", err)
	}
}

func TestPostgres_Delete(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	store := NewPostgres(db)
	user := insertUser(t, db)
	for _, token := range []string{"one", "two"} {
		if _, err := store.Create(t.Context(), NewSession{
			UserID: user, TokenHash: hashOf(token), LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
		}); err != nil {
			t.Fatal(err)
		}
	}

	if err := store.Delete(t.Context(), hashOf("one")); err != nil {
		t.Fatal(err)
	}
	if _, err := store.FindValid(t.Context(), hashOf("one"), now); !errors.Is(err, kit.ErrNotFound) {
		t.Errorf("deleted session: got %v, want kit.ErrNotFound", err)
	}
	if _, err := store.FindValid(t.Context(), hashOf("two"), now); err != nil {
		t.Errorf("other session: %v", err)
	}
	if err := store.Delete(t.Context(), hashOf("one")); err != nil {
		t.Errorf("deleting again: %v", err)
	}
}

func TestPostgres_DeleteExpired(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	store := NewPostgres(db)
	user := insertUser(t, db)
	for token, expiresIn := range map[string]time.Duration{
		"expired":     time.Minute,
		"at the edge": time.Hour,
		"valid":       2 * time.Hour,
	} {
		if _, err := store.Create(t.Context(), NewSession{
			UserID: user, TokenHash: hashOf(token), LastSeenAt: now, ExpiresAt: now.Add(expiresIn),
		}); err != nil {
			t.Fatal(err)
		}
	}

	n, err := store.DeleteExpired(t.Context(), now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Errorf("deleted: got %d, want 2", n)
	}
	var left int
	if err := db.QueryRowContext(t.Context(), `SELECT count(*) FROM sessions`).Scan(&left); err != nil {
		t.Fatal(err)
	}
	if left != 1 {
		t.Errorf("left: got %d, want 1", left)
	}
	if _, err := store.FindValid(t.Context(), hashOf("valid"), now.Add(time.Hour)); err != nil {
		t.Errorf("valid session deleted: %v", err)
	}
}

func TestPostgres_Constraints(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	store := NewPostgres(db)
	user := insertUser(t, db)
	if _, err := store.Create(t.Context(), NewSession{
		UserID: user, TokenHash: hashOf("token"), LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
	}); err != nil {
		t.Fatal(err)
	}

	_, err := store.Create(t.Context(), NewSession{
		UserID: user, TokenHash: hashOf("token"), LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
	})
	testkit.AssertPgCode(t, err, testkit.PgCodeUniqueViolation)

	_, err = store.Create(t.Context(), NewSession{
		UserID: user, TokenHash: []byte("short"), LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
	})
	testkit.AssertPgConstraint(t, err, "sessions_token_hash_check")

	_, err = store.Create(t.Context(), NewSession{
		UserID: user, TokenHash: hashOf("expired"), LastSeenAt: now, ExpiresAt: now,
	})
	testkit.AssertPgConstraint(t, err, "sessions_expiry_check")

	_, err = store.Create(t.Context(), NewSession{
		UserID: "019a0000-0000-7000-8000-000000000001", TokenHash: hashOf("orphan"), LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
	})
	testkit.AssertPgCode(t, err, testkit.PgCodeForeignKeyViolation)
}

// Deleting a user deletes its sessions: both tables belong to identity, so
// the foreign key cascades (ADR 0001 forbids them only across services).
func TestPostgres_UserDeletionCascades(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	store := NewPostgres(db)
	user := insertUser(t, db)
	if _, err := store.Create(t.Context(), NewSession{
		UserID: user, TokenHash: hashOf("token"), LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(t.Context(), `DELETE FROM users WHERE id = $1`, user); err != nil {
		t.Fatal(err)
	}
	if _, err := store.FindValid(t.Context(), hashOf("token"), now); !errors.Is(err, kit.ErrNotFound) {
		t.Errorf("session of a deleted user: got %v, want kit.ErrNotFound", err)
	}
}

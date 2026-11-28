//go:build integration

package login

import (
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/testkit"
)

func TestMain(m *testing.M) {
	os.Exit(testkit.Run(m))
}

const storedHash = "$argon2id$v=19$m=64,t=1,p=1$c29tZXNhbHQ$aGFzaGhhc2hoYXNoaGFzaA"

func insertUser(t *testing.T, db *sql.DB, email string) string {
	t.Helper()
	var id string
	err := db.QueryRowContext(t.Context(),
		`INSERT INTO users (email, password_hash, created_at, updated_at)
		 VALUES ($1, $2, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z') RETURNING id`,
		email, storedHash,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	return id
}

func TestStore_FindByEmail(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	id := insertUser(t, db, "rené@example.com")
	s := NewStore(db)

	u, err := s.FindByEmail(t.Context(), "rené@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if u != (user{ID: id, Email: "rené@example.com", PasswordHash: storedHash}) {
		t.Errorf("user: got %+v", u)
	}

	// The email is compared exactly: callers pass it canonical.
	for _, other := range []string{"RENÉ@example.com", "rené@example.com", "other@example.com"} {
		if _, err := s.FindByEmail(t.Context(), other); !errors.Is(err, kit.ErrNotFound) {
			t.Errorf("%q: got %v, want kit.ErrNotFound", other, err)
		}
	}
}

func TestStore_UpdatePasswordHash(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	id := insertUser(t, db, "a@example.com")
	s := NewStore(db)

	const newHash = "$argon2id$v=19$m=128,t=2,p=1$c29tZXNhbHQ$aGFzaGhhc2hoYXNoaGFzaA"
	if err := s.UpdatePasswordHash(t.Context(), id, newHash); err != nil {
		t.Fatal(err)
	}
	var got string
	var createdAt, updatedAt time.Time
	if err := db.QueryRowContext(t.Context(),
		`SELECT password_hash, created_at, updated_at FROM users WHERE id = $1`, id,
	).Scan(&got, &createdAt, &updatedAt); err != nil {
		t.Fatal(err)
	}
	if got != newHash {
		t.Errorf("hash: got %q", got)
	}
	if !createdAt.Equal(time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)) || !updatedAt.After(createdAt) {
		t.Errorf("timestamps: created_at %v, updated_at %v; want created_at kept and updated_at moved", createdAt, updatedAt)
	}

	if err := s.UpdatePasswordHash(t.Context(), "019a0000-0000-7000-8000-000000000001", newHash); !errors.Is(err, kit.ErrNotFound) {
		t.Errorf("unknown user: got %v, want kit.ErrNotFound", err)
	}
	if err := s.UpdatePasswordHash(t.Context(), id, "plain"); err == nil {
		t.Error("stored a hash that isn't argon2id")
	}
}

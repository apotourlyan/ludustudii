//go:build integration

package get

import (
	"context"
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

// insertCard inserts card as it is, timestamps included.
func insertCard(t *testing.T, db *sql.DB, card row) {
	t.Helper()
	_, err := db.ExecContext(t.Context(),
		`INSERT INTO learning_cards (id, title, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		card.ID, card.Title, card.Description, card.CreatedAt, card.UpdatedAt,
	)
	if err != nil {
		t.Fatalf("insert card: %v", err)
	}
}

func TestStore_Get(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	// The timestamps all differ, so a row that gets the other card's or
	// swaps its own fails the comparison.
	other := row{
		ID:          "01a1730e-199d-7f9f-b59d-3bcd6f84066a",
		Title:       "Title 1",
		Description: "Description 1",
		CreatedAt:   time.Date(2026, 11, 18, 9, 0, 0, 0, time.UTC),
		UpdatedAt:   time.Date(2026, 11, 18, 9, 5, 0, 0, time.UTC),
	}
	want := row{
		ID:          "01a1730e-199d-7f9f-b59d-3bcd6f84066b",
		Title:       "Title 2",
		Description: "Description 2",
		CreatedAt:   time.Date(2026, 11, 18, 10, 0, 0, 123456000, time.UTC),
		UpdatedAt:   time.Date(2026, 11, 18, 10, 30, 0, 654321000, time.UTC),
	}
	insertCard(t, db, other)
	insertCard(t, db, want)

	got, err := s.Get(t.Context(), want.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// The driver may return the timestamps in another location; the instant
	// is what counts.
	got.CreatedAt = got.CreatedAt.UTC()
	got.UpdatedAt = got.UpdatedAt.UTC()
	if got != want {
		t.Errorf("row: got %+v, want %+v", got, want)
	}
}

func TestStore_Get_NotFound(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	_, err := s.Get(t.Context(), "01a1730e-199d-7f9f-b59d-3bcd6f84066c")
	if !errors.Is(err, kit.ErrNotFound) {
		t.Errorf("err: got %v, want %v", err, kit.ErrNotFound)
	}
}

// TestStore_Get_RejectsNonUUID pins that learning_cards.id is a UUID column
// rather than TEXT (which would return kit.ErrNotFound instead of 22P02).
func TestStore_Get_RejectsNonUUID(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	_, err := s.Get(t.Context(), "not-a-uuid")
	testkit.AssertPgCode(t, err, testkit.PgCodeInvalidTextRepresentation)
}

func TestStore_Get_CanceledContext(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	_, err := s.Get(ctx, "01a1730e-199d-7f9f-b59d-3bcd6f84066c")
	if !errors.Is(err, context.Canceled) {
		t.Errorf("err: got %v, want %v", err, context.Canceled)
	}
}

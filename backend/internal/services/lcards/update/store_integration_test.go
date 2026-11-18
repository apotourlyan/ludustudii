//go:build integration

package update

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/services/lcards/domain"
	"github.com/apotourlyan/ludustudii/internal/testkit"
)

func TestMain(m *testing.M) {
	os.Exit(testkit.Run(m))
}

func insertCard(t *testing.T, db *sql.DB, id, title, description string) {
	t.Helper()
	_, err := db.ExecContext(t.Context(),
		`INSERT INTO learning_cards (id, title, description, created_at, updated_at) VALUES ($1, $2, $3, now(), now())`,
		id, title, description,
	)
	if err != nil {
		t.Fatalf("insert card: %v", err)
	}
}

type cardRow struct {
	ID          string
	Title       string
	Description string
}

func getCard(t *testing.T, db *sql.DB, id string) cardRow {
	t.Helper()
	var got cardRow
	err := db.QueryRowContext(t.Context(),
		`SELECT id, title, description FROM learning_cards WHERE id = $1`, id,
	).Scan(&got.ID, &got.Title, &got.Description)
	if err != nil {
		t.Fatalf("query card: %v", err)
	}
	return got
}

func TestStore_Update(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	const (
		id1 = "01a1730e-199d-7f9f-b59d-3bcd6f84066a"
		id2 = "01a1730e-199d-7f9f-b59d-3bcd6f84066b"
	)
	other := updateParams{
		ID:          id1,
		Title:       "Other Title",
		Description: "Other Description",
	}
	insertCard(t, db, other.ID, other.Title, other.Description)
	insertCard(t, db, id2, "Old Title", "Old Description")

	want := updateParams{
		ID:          id2,
		Title:       "New Title",
		Description: "New Description",
	}
	if err := s.Update(t.Context(), want); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := getCard(t, db, id2); got != cardRow(want) {
		t.Errorf("updated card: got %+v, want %+v", got, want)
	}
	if got := getCard(t, db, id1); got != cardRow(other) {
		t.Errorf("other card: got %+v, want %+v", got, other)
	}
}

func TestStore_Update_MaxLengths(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
	insertCard(t, db, id, "Old Title", "Old Description")

	want := updateParams{
		ID:          id,
		Title:       strings.Repeat("\u00E9", domain.TitleMaxLength),
		Description: strings.Repeat("\u00E9", domain.DescriptionMaxLength),
	}
	if err := s.Update(t.Context(), want); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := getCard(t, db, id); got != cardRow(want) {
		t.Errorf("row lengths: got (%d, %d), want (%d, %d)",
			utf8.RuneCountInString(got.Title), utf8.RuneCountInString(got.Description),
			utf8.RuneCountInString(want.Title), utf8.RuneCountInString(want.Description))
	}
}

func TestStore_Update_NotFound(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	err := s.Update(t.Context(), updateParams{
		ID:          "01a1730e-199d-7f9f-b59d-3bcd6f84066c",
		Title:       "Title",
		Description: "Description",
	})
	if !errors.Is(err, kit.ErrNotFound) {
		t.Errorf("err: got %v, want %v", err, kit.ErrNotFound)
	}
}

// TestStore_Update_RejectsNonUUID pins that learning_cards.id is a UUID column
// rather than TEXT (which would return kit.ErrNotFound instead of 22P02).
func TestStore_Update_RejectsNonUUID(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	err := s.Update(t.Context(), updateParams{
		ID:          "not-a-uuid",
		Title:       "Title",
		Description: "Description",
	})
	testkit.AssertPgCode(t, err, testkit.PgCodeInvalidTextRepresentation)
}

func TestStore_Update_CheckConstraints(t *testing.T) {
	t.Parallel()

	const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"

	tests := []struct {
		name           string
		params         updateParams
		wantConstraint string
	}{
		{
			name: "empty title",
			params: updateParams{
				ID:          id,
				Title:       "",
				Description: "Description",
			},
			wantConstraint: "learning_cards_title_check",
		},
		{
			name: "title over max length",
			params: updateParams{
				ID:          id,
				Title:       strings.Repeat("a", domain.TitleMaxLength+1),
				Description: "Description",
			},
			wantConstraint: "learning_cards_title_check",
		},
		{
			name: "empty description",
			params: updateParams{
				ID:          id,
				Title:       "Title",
				Description: "",
			},
			wantConstraint: "learning_cards_description_check",
		},
		{
			name: "description over max length",
			params: updateParams{
				ID:          id,
				Title:       "Title",
				Description: strings.Repeat("a", domain.DescriptionMaxLength+1),
			},
			wantConstraint: "learning_cards_description_check",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			db := testkit.NewDB(t)
			s := NewStore(db)

			original := updateParams{
				ID:          id,
				Title:       "Original Title",
				Description: "Original Description",
			}
			insertCard(t, db, original.ID, original.Title, original.Description)

			err := s.Update(t.Context(), tt.params)
			testkit.AssertPgConstraint(t, err, tt.wantConstraint)

			if got := getCard(t, db, id); got != cardRow(original) {
				t.Errorf("card after failed update: got %+v, want %+v", got, original)
			}
		})
	}
}

func TestStore_Update_CanceledContext(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	err := s.Update(ctx, updateParams{
		ID:          "01a1730e-199d-7f9f-b59d-3bcd6f84066c",
		Title:       "Title",
		Description: "Description",
	})
	if !errors.Is(err, context.Canceled) {
		t.Errorf("err: got %v, want %v", err, context.Canceled)
	}
}

func TestStore_Update_Timestamps(t *testing.T) {
	t.Parallel()
	db := testkit.NewDB(t)
	s := NewStore(db)
	const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
	// Seed an earlier database timestamp so strict advancement needs no sleep.
	if _, err := db.ExecContext(t.Context(), `
		INSERT INTO learning_cards (id, title, description, created_at, updated_at)
		VALUES ($1, 'Original', 'Original description', now() - interval '1 second', now() - interval '1 second')`, id); err != nil {
		t.Fatalf("insert card: %v", err)
	}
	createdBefore, updatedBefore := getTimestamps(t, db, id)
	p := updateParams{ID: id, Title: "Updated", Description: "Updated description"}
	if err := s.Update(t.Context(), p); err != nil {
		t.Fatalf("update: %v", err)
	}
	createdAfter, updatedAfter := getTimestamps(t, db, id)
	if !createdAfter.Equal(createdBefore) || !updatedAfter.After(updatedBefore) {
		t.Fatalf("timestamps after update: created_at %v (was %v), updated_at %v (was %v)",
			createdAfter, createdBefore, updatedAfter, updatedBefore)
	}
}

func getTimestamps(t *testing.T, db *sql.DB, id string) (time.Time, time.Time) {
	t.Helper()
	var createdAt, updatedAt time.Time
	if err := db.QueryRowContext(t.Context(),
		`SELECT created_at, updated_at FROM learning_cards WHERE id = $1`, id,
	).Scan(&createdAt, &updatedAt); err != nil {
		t.Fatalf("query timestamps: %v", err)
	}
	return createdAt, updatedAt
}

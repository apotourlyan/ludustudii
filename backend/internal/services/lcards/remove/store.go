package remove

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"

	"github.com/apotourlyan/ludustudii/internal/kit"
)

//go:embed remove.sql
var removeSQL string

// Store deletes learning cards from the database.
type Store struct {
	db *sql.DB
}

// NewStore returns a Store that uses db.
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Delete removes the card with the given ID, or returns kit.ErrNotFound for
// an unknown ID.
func (s *Store) Delete(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, removeSQL, id)
	if err != nil {
		return fmt.Errorf("delete: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("delete: rows affected: %w", err)
	}
	if n == 0 {
		return kit.ErrNotFound
	}
	return nil
}

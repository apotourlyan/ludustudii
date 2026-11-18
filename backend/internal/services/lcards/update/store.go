package update

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"

	"github.com/apotourlyan/ludustudii/internal/kit"
)

//go:embed update.sql
var updateSQL string

type updateParams struct {
	ID          string
	Title       string
	Description string
}

// Store updates learning cards in the database.
type Store struct {
	db *sql.DB
}

// NewStore returns a Store that uses db.
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Update replaces the title and description of card p.ID, or returns
// kit.ErrNotFound for an unknown ID.
func (s *Store) Update(ctx context.Context, p updateParams) error {
	res, err := s.db.ExecContext(ctx, updateSQL, p.Title, p.Description, p.ID)
	if err != nil {
		return fmt.Errorf("update: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("update: rows affected: %w", err)
	}
	if n == 0 {
		return kit.ErrNotFound
	}
	return nil
}

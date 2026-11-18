package create

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
)

//go:embed create.sql
var createSQL string

type createParams struct {
	Title       string
	Description string
}

type row struct {
	ID string
}

// Store inserts learning cards into the database.
type Store struct {
	db *sql.DB
}

// NewStore returns a Store that uses db.
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Create inserts a card and returns its database-generated ID.
func (s *Store) Create(ctx context.Context, p createParams) (row, error) {
	var data row
	err := s.db.
		QueryRowContext(ctx, createSQL, p.Title, p.Description).
		Scan(&data.ID)
	if err != nil {
		return row{}, fmt.Errorf("create: %w", err)
	}
	return data, nil
}

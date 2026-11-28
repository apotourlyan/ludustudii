package me

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"

	"github.com/apotourlyan/ludustudii/internal/kit"
)

//go:embed get.sql
var getSQL string

type row struct {
	ID    string
	Email string
}

// Store reads users from the database.
type Store struct {
	db *sql.DB
}

// NewStore returns a Store that uses db.
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Get returns the user with id, or kit.ErrNotFound.
func (s *Store) Get(ctx context.Context, id string) (row, error) {
	var data row
	err := s.db.QueryRowContext(ctx, getSQL, id).Scan(&data.ID, &data.Email)
	if errors.Is(err, sql.ErrNoRows) {
		return row{}, kit.ErrNotFound
	}
	if err != nil {
		return row{}, fmt.Errorf("get user: %w", err)
	}
	return data, nil
}

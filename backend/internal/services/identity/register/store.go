package register

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"

	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
	"github.com/jackc/pgx/v5/pgconn"
)

//go:embed create.sql
var createSQL string

// The unique constraint on users.email, and the SQLSTATE of its violation.
const (
	emailConstraint = "users_email_key"
	uniqueViolation = "23505"
)

type createParams struct {
	Email        string
	PasswordHash string
}

type row struct {
	ID    string
	Email string
}

// Store inserts users into the database.
type Store struct {
	db *sql.DB
}

// NewStore returns a Store that uses db.
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Create inserts a user and returns its database-generated ID, or an error
// wrapping domain.ErrEmailTaken when the email has an account.
func (s *Store) Create(ctx context.Context, p createParams) (row, error) {
	var data row
	err := s.db.
		QueryRowContext(ctx, createSQL, p.Email, p.PasswordHash).
		Scan(&data.ID, &data.Email)
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok &&
		pgErr.Code == uniqueViolation && pgErr.ConstraintName == emailConstraint {
		return row{}, fmt.Errorf("create user: %w", domain.ErrEmailTaken)
	}
	if err != nil {
		return row{}, fmt.Errorf("create user: %w", err)
	}
	return data, nil
}

package login

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"

	"github.com/apotourlyan/ludustudii/internal/kit"
)

var (
	//go:embed find_user.sql
	findUserSQL string
	//go:embed update_password_hash.sql
	updatePasswordHashSQL string
)

type user struct {
	ID           string
	Email        string
	PasswordHash string
}

// Store reads users and replaces their password hashes.
type Store struct {
	db *sql.DB
}

// NewStore returns a Store that uses db.
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// FindByEmail returns the user with the canonical email, or kit.ErrNotFound.
func (s *Store) FindByEmail(ctx context.Context, email string) (user, error) {
	var u user
	err := s.db.QueryRowContext(ctx, findUserSQL, email).Scan(&u.ID, &u.Email, &u.PasswordHash)
	if errors.Is(err, sql.ErrNoRows) {
		return user{}, kit.ErrNotFound
	}
	if err != nil {
		return user{}, fmt.Errorf("find user: %w", err)
	}
	return u, nil
}

// UpdatePasswordHash replaces the password hash of the user with id.
func (s *Store) UpdatePasswordHash(ctx context.Context, id, hash string) error {
	res, err := s.db.ExecContext(ctx, updatePasswordHashSQL, id, hash)
	if err != nil {
		return fmt.Errorf("update password hash: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("update password hash: rows affected: %w", err)
	}
	if n == 0 {
		return kit.ErrNotFound
	}
	return nil
}

package sessions

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit"
)

var (
	//go:embed create.sql
	createSQL string
	//go:embed find_valid.sql
	findValidSQL string
	//go:embed touch.sql
	touchSQL string
	//go:embed delete.sql
	deleteSQL string
	//go:embed delete_expired.sql
	deleteExpiredSQL string
)

// Session is a stored session. Its token isn't part of it: only the token's
// hash is stored.
type Session struct {
	ID         string
	UserID     string
	LastSeenAt time.Time
	ExpiresAt  time.Time
	CreatedAt  time.Time
}

// NewSession is what Create stores.
type NewSession struct {
	UserID     string
	TokenHash  []byte
	LastSeenAt time.Time
	ExpiresAt  time.Time
}

// Store keeps sessions, looked up by the hash of their token. Postgres is the
// implementation; another store, such as Redis behind a gateway, would
// implement the same methods.
type Store interface {
	// Create stores a session and returns it with its ID and creation time.
	Create(ctx context.Context, s NewSession) (Session, error)
	// FindValid returns the session with tokenHash that expires after now,
	// or kit.ErrNotFound.
	FindValid(ctx context.Context, tokenHash []byte, now time.Time) (Session, error)
	// Touch records a use of the session with id and its new expiry.
	Touch(ctx context.Context, id string, lastSeenAt, expiresAt time.Time) error
	// Delete deletes the session with tokenHash, if there is one.
	Delete(ctx context.Context, tokenHash []byte) error
	// DeleteExpired deletes the sessions that expire at or before now and
	// returns how many it deleted.
	DeleteExpired(ctx context.Context, now time.Time) (int64, error)
}

// Postgres is the Store in the sessions table.
type Postgres struct {
	db *sql.DB
}

var _ Store = (*Postgres)(nil)

// NewPostgres returns a Postgres store that uses db.
func NewPostgres(db *sql.DB) *Postgres {
	return &Postgres{db: db}
}

// Create inserts a session; the database generates its ID and creation time.
func (p *Postgres) Create(ctx context.Context, s NewSession) (Session, error) {
	out := Session{UserID: s.UserID, LastSeenAt: s.LastSeenAt, ExpiresAt: s.ExpiresAt}
	err := p.db.
		QueryRowContext(ctx, createSQL, s.UserID, s.TokenHash, s.LastSeenAt, s.ExpiresAt).
		Scan(&out.ID, &out.CreatedAt)
	if err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}
	return out, nil
}

// FindValid returns the unexpired session with tokenHash, or kit.ErrNotFound.
func (p *Postgres) FindValid(ctx context.Context, tokenHash []byte, now time.Time) (Session, error) {
	var s Session
	err := p.db.
		QueryRowContext(ctx, findValidSQL, tokenHash, now).
		Scan(&s.ID, &s.UserID, &s.LastSeenAt, &s.ExpiresAt, &s.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Session{}, kit.ErrNotFound
	}
	if err != nil {
		return Session{}, fmt.Errorf("find session: %w", err)
	}
	return s, nil
}

// Touch updates the session's last use and expiry. A session deleted
// meanwhile is not an error.
func (p *Postgres) Touch(ctx context.Context, id string, lastSeenAt, expiresAt time.Time) error {
	if _, err := p.db.ExecContext(ctx, touchSQL, id, lastSeenAt, expiresAt); err != nil {
		return fmt.Errorf("touch session: %w", err)
	}
	return nil
}

// Delete deletes the session with tokenHash; deleting none is not an error.
func (p *Postgres) Delete(ctx context.Context, tokenHash []byte) error {
	if _, err := p.db.ExecContext(ctx, deleteSQL, tokenHash); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

// DeleteExpired deletes every session that expires at or before now.
func (p *Postgres) DeleteExpired(ctx context.Context, now time.Time) (int64, error) {
	res, err := p.db.ExecContext(ctx, deleteExpiredSQL, now)
	if err != nil {
		return 0, fmt.Errorf("delete expired sessions: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("delete expired sessions: rows affected: %w", err)
	}
	return n, nil
}

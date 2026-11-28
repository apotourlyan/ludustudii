//go:build integration

package register

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit/validator"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
	"github.com/apotourlyan/ludustudii/internal/testkit"
)

func TestMain(m *testing.M) {
	os.Exit(testkit.Run(m))
}

const hash = "$argon2id$v=19$m=64,t=1,p=1$c29tZXNhbHQ$aGFzaGhhc2hoYXNoaGFzaA"

func TestStore_Create(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)

	data, err := s.Create(t.Context(), createParams{Email: "rené@example.com", PasswordHash: hash})
	if err != nil {
		t.Fatal(err)
	}
	if err := validator.UUID7("id", data.ID); err != nil {
		t.Errorf("id %q: %v", data.ID, err)
	}
	if data.Email != "rené@example.com" {
		t.Errorf("email: got %q", data.Email)
	}

	var email, storedHash string
	var verified *time.Time
	var createdAt, updatedAt time.Time
	if err := db.QueryRowContext(t.Context(),
		`SELECT email, password_hash, email_verified_at, created_at, updated_at FROM users WHERE id = $1`, data.ID,
	).Scan(&email, &storedHash, &verified, &createdAt, &updatedAt); err != nil {
		t.Fatal(err)
	}
	if email != data.Email || storedHash != hash || verified != nil {
		t.Errorf("row: email %q, hash %q, verified %v", email, storedHash, verified)
	}
	if createdAt.IsZero() || !createdAt.Equal(updatedAt) {
		t.Errorf("timestamps: created_at %v, updated_at %v; want set and equal", createdAt, updatedAt)
	}
}

func TestStore_Create_Taken(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	s := NewStore(db)
	if _, err := s.Create(t.Context(), createParams{Email: "a@example.com", PasswordHash: hash}); err != nil {
		t.Fatal(err)
	}
	_, err := s.Create(t.Context(), createParams{Email: "a@example.com", PasswordHash: hash})
	if !errors.Is(err, domain.ErrEmailTaken) {
		t.Errorf("err: got %v, want domain.ErrEmailTaken", err)
	}
}

func TestStore_Create_MaxLength(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	email := strings.Repeat("é", domain.EmailMaxLength-2) + "@b"
	if _, err := NewStore(db).Create(t.Context(), createParams{Email: email, PasswordHash: hash}); err != nil {
		t.Errorf("email at max length: %v", err)
	}
}

// The longest hash kit/password accepts fits, and so does the cap.
func TestStore_Create_PasswordHashLengths(t *testing.T) {
	t.Parallel()

	longest := "$argon2id$v=19$m=4194304,t=1024,p=255$" + strings.Repeat("A", 86) + "$" + strings.Repeat("A", 86)
	if len(longest) != 211 {
		t.Fatalf("longest hash: %d characters, want 211", len(longest))
	}
	atCap := hash + strings.Repeat("a", 255-len(hash))
	for i, h := range []string{longest, atCap} {
		email := fmt.Sprintf("hash-%d@example.com", i)
		if _, err := NewStore(testkit.NewDB(t)).Create(t.Context(), createParams{Email: email, PasswordHash: h}); err != nil {
			t.Errorf("%d-character hash: %v", len(h), err)
		}
	}
}

func TestStore_Create_CheckConstraints(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name           string
		params         createParams
		wantConstraint string
	}{
		{"empty email", createParams{Email: "", PasswordHash: hash}, "users_email_check"},
		{"no @", createParams{Email: "example.com", PasswordHash: hash}, "users_email_check"},
		{"two @", createParams{Email: "a@b@c", PasswordHash: hash}, "users_email_check"},
		{"nothing before @", createParams{Email: "@b", PasswordHash: hash}, "users_email_check"},
		{"email over max length", createParams{Email: strings.Repeat("a", domain.EmailMaxLength-1) + "@b", PasswordHash: hash}, "users_email_check"},
		{"not an argon2id hash", createParams{Email: "a@b", PasswordHash: "plain text"}, "users_password_hash_check"},
		{"hash over 255 characters", createParams{Email: "a@b", PasswordHash: hash + strings.Repeat("a", 256-len(hash))}, "users_password_hash_check"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := NewStore(testkit.NewDB(t)).Create(t.Context(), tt.params)
			testkit.AssertPgConstraint(t, err, tt.wantConstraint)
		})
	}
}

func TestStore_Create_CanceledContext(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err := NewStore(testkit.NewDB(t)).Create(ctx, createParams{Email: "a@b", PasswordHash: hash})
	if !errors.Is(err, context.Canceled) {
		t.Errorf("err: got %v, want %v", err, context.Canceled)
	}
}

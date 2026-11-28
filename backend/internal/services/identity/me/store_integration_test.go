//go:build integration

package me

import (
	"errors"
	"os"
	"testing"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/testkit"
)

func TestMain(m *testing.M) {
	os.Exit(testkit.Run(m))
}

func TestStore_Get(t *testing.T) {
	t.Parallel()

	db := testkit.NewDB(t)
	var id string
	if err := db.QueryRowContext(t.Context(),
		`INSERT INTO users (email, password_hash, created_at, updated_at)
		 VALUES ('a@example.com', '$argon2id$v=19$m=64,t=1,p=1$c29tZXNhbHQ$aGFzaGhhc2hoYXNoaGFzaA', now(), now())
		 RETURNING id`,
	).Scan(&id); err != nil {
		t.Fatal(err)
	}
	s := NewStore(db)

	got, err := s.Get(t.Context(), id)
	if err != nil {
		t.Fatal(err)
	}
	if got != (row{ID: id, Email: "a@example.com"}) {
		t.Errorf("got %+v", got)
	}
	if _, err := s.Get(t.Context(), "019a0000-0000-7000-8000-000000000001"); !errors.Is(err, kit.ErrNotFound) {
		t.Errorf("unknown user: got %v, want kit.ErrNotFound", err)
	}
}

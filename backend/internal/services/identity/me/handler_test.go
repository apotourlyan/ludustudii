//go:build unit

package me

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/kit/authn"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
)

const userID = "019a0000-0000-7000-8000-000000000001"

type mockStore struct {
	getFn func(ctx context.Context, id string) (row, error)
}

func (m *mockStore) Get(ctx context.Context, id string) (row, error) { return m.getFn(ctx, id) }

func TestHandler_Handle(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name     string
		user     string
		getFn    func(context.Context, string) (row, error)
		wantCode int
		wantErr  error
	}{
		{
			name: "anonymous",
			getFn: func(context.Context, string) (row, error) {
				t.Error("looked up an anonymous user")
				return row{}, nil
			},
			wantErr: httpkit.ErrUnauthenticated,
		},
		{
			name:    "user deleted meanwhile",
			user:    userID,
			getFn:   func(context.Context, string) (row, error) { return row{}, kit.ErrNotFound },
			wantErr: httpkit.ErrUnauthenticated,
		},
		{
			name:     "store error",
			user:     userID,
			getFn:    func(context.Context, string) (row, error) { return row{}, errors.New("boom") },
			wantCode: http.StatusInternalServerError,
		},
		{
			name: "authenticated",
			user: userID,
			getFn: func(_ context.Context, id string) (row, error) {
				return row{ID: id, Email: "a@example.com"}, nil
			},
			wantCode: http.StatusOK,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := t.Context()
			if tt.user != "" {
				ctx = authn.WithUserID(ctx, tt.user)
			}
			rec := httptest.NewRecorder()
			err := NewHandler(&mockStore{getFn: tt.getFn}).Handle(rec, httptest.NewRequestWithContext(ctx, http.MethodGet, "/api/users/me", nil))

			switch {
			case tt.wantErr != nil:
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("got %v, want %v", err, tt.wantErr)
				}
			case tt.wantCode == http.StatusInternalServerError:
				if err == nil || httpkit.StatusCode(err) != 0 {
					t.Fatalf("got %v, want an untyped error", err)
				}
			default:
				if err != nil {
					t.Fatal(err)
				}
				var got response
				if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
					t.Fatal(err)
				}
				if got != (response{ID: userID, Email: "a@example.com"}) || rec.Code != http.StatusOK {
					t.Errorf("got %d %+v", rec.Code, got)
				}
			}
		})
	}
}

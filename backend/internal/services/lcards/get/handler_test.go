//go:build unit

package get

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit"
	"github.com/apotourlyan/ludustudii/internal/kit/erresp"
	"github.com/apotourlyan/ludustudii/internal/kit/httpkit"
)

type mockStore struct {
	getFn func(ctx context.Context, id string) (row, error)
}

func (m *mockStore) Get(ctx context.Context, id string) (row, error) {
	return m.getFn(ctx, id)
}

func testContext(t *testing.T, id string) (*http.Request, *httptest.ResponseRecorder) {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/lcards/"+id, nil)
	rec := httptest.NewRecorder()
	req.SetPathValue("id", id)
	return req, rec
}

func testHandler(t *testing.T, store func(*mockStore), setup func(*Handler)) *Handler {
	t.Helper()

	m := &mockStore{
		getFn: func(ctx context.Context, id string) (row, error) {
			t.Fatal("unexpected call to getFn")
			return row{}, errors.New("")
		},
	}
	if store != nil {
		store(m)
	}

	h := &Handler{
		store:           m,
		validateParamID: func(id string) error { return nil },
	}
	if setup != nil {
		setup(h)
	}

	return h
}

func TestHandler_Handle(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		setup       func(*Handler)
		store       func(*mockStore)
		wantCode    int
		wantResp    *response
		wantErrCode string
	}{
		{
			name: "path validation error",
			setup: func(h *Handler) {
				h.validateParamID = func(id string) error {
					return errors.New("")
				}
			},
			wantCode:    http.StatusBadRequest,
			wantErrCode: erresp.CodeValidation,
		},
		{
			name: "not found error",
			store: func(m *mockStore) {
				m.getFn = func(_ context.Context, _ string) (row, error) {
					return row{}, kit.ErrNotFound
				}
			},
			wantCode:    http.StatusNotFound,
			wantErrCode: erresp.CodeNotFound,
		},
		{
			name: "get error",
			store: func(m *mockStore) {
				m.getFn = func(_ context.Context, _ string) (row, error) {
					return row{}, errors.New("")
				}
			},
			wantCode:    http.StatusInternalServerError,
			wantErrCode: erresp.CodeUnexpected,
		},
		{
			name: "success",
			store: func(m *mockStore) {
				m.getFn = func(_ context.Context, _ string) (row, error) {
					return row{
						ID:          "01a1730e-199d-7f9f-b59d-3bcd6f84066c",
						Title:       "Title",
						Description: "Description",
					}, nil
				}
			},
			wantCode: http.StatusOK,
			wantResp: &response{
				ID:          "01a1730e-199d-7f9f-b59d-3bcd6f84066c",
				Title:       "Title",
				Description: "Description",
			},
		},
	}

	id := "01a1730e-199d-7f9f-b59d-3bcd6f84066c"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			// Setup request and request/response recorder
			c, rec := testContext(t, id)

			// Setup handler with mock store
			h := testHandler(t, tt.store, tt.setup)

			err := h.Handle(rec, c)
			if tt.wantErrCode != "" {
				if err == nil {
					t.Fatal("expected returned error")
				}
				if rec.Body.Len() != 0 || rec.Flushed || len(rec.Header()) != 0 {
					t.Fatalf("error response was written: %s", rec.Body.String())
				}
				switch tt.wantCode {
				case http.StatusInternalServerError:
					if httpkit.StatusCode(err) != 0 {
						t.Fatalf("expected untyped store error, got %v", err)
					}
				case http.StatusNotFound:
					if !errors.Is(err, kit.ErrNotFound) {
						t.Fatalf("expected not found, got %v", err)
					}
				default:
					typed, ok := errors.AsType[*httpkit.StatusError](err)
					if !ok || typed.Code != tt.wantCode || typed.Response.Code != tt.wantErrCode {
						t.Fatalf("returned error: got %#v, want %d %s", err, tt.wantCode, tt.wantErrCode)
					}
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			// Check the status code first
			if rec.Code != tt.wantCode {
				t.Fatalf("status: got %d, want %d", rec.Code, tt.wantCode)
			}

			// Check the response body if expected response is provided
			if tt.wantResp != nil {
				var got response
				if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
					t.Fatalf("unmarshal response: %v", err)
				}
				if got != *tt.wantResp {
					t.Errorf("resp: got %+v, want %+v", got, *tt.wantResp)
				}
			}
		})
	}
}

func TestToResp(t *testing.T) {
	t.Parallel()

	const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
	// The store may return the timestamps in any location; the response
	// gives the same instants in UTC.
	plusOne := time.FixedZone("UTC+1", 60*60)
	got := toResp(row{
		ID:          id,
		Title:       "Title",
		Description: "Description",
		CreatedAt:   time.Date(2026, 11, 18, 10, 0, 0, 0, plusOne),
		UpdatedAt:   time.Date(2026, 11, 18, 10, 30, 0, 0, plusOne),
	})
	want := response{
		ID:          id,
		Title:       "Title",
		Description: "Description",
		CreatedAt:   time.Date(2026, 11, 18, 9, 0, 0, 0, time.UTC),
		UpdatedAt:   time.Date(2026, 11, 18, 9, 30, 0, 0, time.UTC),
	}
	if got != want {
		t.Errorf("resp: got %+v, want %+v", got, want)
	}
}

func TestToResp_JSON(t *testing.T) {
	t.Parallel()

	got, err := json.Marshal(toResp(row{
		ID:          "01a1730e-199d-7f9f-b59d-3bcd6f84066c",
		Title:       "Title",
		Description: "Description",
		CreatedAt:   time.Date(2026, 11, 18, 10, 0, 0, 123456000, time.FixedZone("UTC+1", 60*60)),
		UpdatedAt:   time.Date(2026, 11, 18, 9, 30, 0, 0, time.UTC),
	}))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	want := `{"id":"01a1730e-199d-7f9f-b59d-3bcd6f84066c","title":"Title","description":"Description",` +
		`"created_at":"2026-11-18T09:00:00.123456Z","updated_at":"2026-11-18T09:30:00Z"}`
	if string(got) != want {
		t.Errorf("json:\n got %s\nwant %s", got, want)
	}
}

func TestHandler_Wiring(t *testing.T) {
	t.Parallel()

	c, rec := testContext(t, "01A1730E-199D-7F9F-B59D-3BCD6F84066C")

	var gotID string
	m := &mockStore{
		getFn: func(_ context.Context, id string) (row, error) {
			gotID = id
			return row{
				ID:          "01a1730e-199d-7f9f-b59d-3bcd6f84066c",
				Title:       "Title",
				Description: "Description",
			}, nil
		},
	}
	h := NewHandler(m)

	if err := h.Handle(rec, c); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rec.Code, http.StatusOK)
	}

	wantID := "01a1730e-199d-7f9f-b59d-3bcd6f84066c" // lowercased
	if gotID != wantID {
		t.Errorf("id: got %q, want %q", gotID, wantID)
	}

	var gotResp response
	if err := json.Unmarshal(rec.Body.Bytes(), &gotResp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	wantResp := response{
		ID:          "01a1730e-199d-7f9f-b59d-3bcd6f84066c",
		Title:       "Title",
		Description: "Description",
	}
	if gotResp != wantResp {
		t.Errorf("resp: got %+v, want %+v", gotResp, wantResp)
	}
}

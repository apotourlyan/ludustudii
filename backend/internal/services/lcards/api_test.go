//go:build integration

package lcards_test

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/app/api"
	"github.com/apotourlyan/ludustudii/internal/app/router"
	"github.com/apotourlyan/ludustudii/internal/testkit"
	"github.com/google/uuid"
)

func TestMain(m *testing.M) {
	os.Exit(testkit.Run(m))
}

func newServer(t *testing.T) (*httptest.Server, *sql.DB) {
	t.Helper()
	db := testkit.NewDB(t)
	log := slog.New(slog.DiscardHandler)
	onError := router.ErrorHandler(log)
	surface, err := api.New(db, testkit.IdentityConfig(), onError)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(router.New(log, onError, surface))
	t.Cleanup(srv.Close)
	return srv, db
}

type cardRow struct {
	Title       string
	Description string
}

// The timestamps insertCard gives every card, written with an offset.
// Responses give the same instants in UTC, as RFC 3339:
// "2026-11-18T09:15:30.123456Z" and "2026-11-18T09:20:00Z". They differ, so
// a response that swaps them fails.
const (
	seededCreatedAt = "2026-11-18T10:15:30.123456+01:00"
	seededUpdatedAt = "2026-11-18T10:20:00+01:00"
)

func insertCard(t *testing.T, db *sql.DB, id, title, description string) {
	t.Helper()
	_, err := db.ExecContext(t.Context(),
		`INSERT INTO learning_cards (id, title, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		id, title, description, seededCreatedAt, seededUpdatedAt,
	)
	if err != nil {
		t.Fatalf("insert card: %v", err)
	}
}

func getCard(t *testing.T, db *sql.DB, id string) cardRow {
	t.Helper()
	var got cardRow
	err := db.QueryRowContext(t.Context(),
		`SELECT title, description FROM learning_cards WHERE id = $1`, id,
	).Scan(&got.Title, &got.Description)
	if err != nil {
		t.Fatalf("query card: %v", err)
	}
	return got
}

func cardExists(t *testing.T, db *sql.DB, id string) bool {
	t.Helper()
	var exists bool
	err := db.QueryRowContext(t.Context(),
		`SELECT EXISTS (SELECT 1 FROM learning_cards WHERE id = $1)`, id,
	).Scan(&exists)
	if err != nil {
		t.Fatalf("check card exists: %v", err)
	}
	return exists
}

func TestRouting(t *testing.T) {
	t.Parallel()

	t.Run("GET extra segment under card ID returns 404", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodGet,
			Path:   "/api/lcards/01a1730e-199d-7f9f-b59d-3bcd6f84066c/extra",
		})
		testkit.AssertStatus(t, resp, http.StatusNotFound)
		testkit.AssertJSON(t, resp.Body, `{"code":"not_found"}`)
	})

	t.Run("HEAD /api/lcards returns 200 with JSON content-type", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodHead,
			Path:   "/api/lcards",
		})
		testkit.AssertStatus(t, resp, http.StatusOK)
		if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
			t.Errorf("content-type: got %q, want JSON", ct)
		}
	})

	// AutoHandleHEAD runs the GET handler and suppresses its body for both
	// successful lookups and errors. Both API paths document HEAD explicitly.
	for _, status := range []int{http.StatusOK, http.StatusNotFound} {
		t.Run(fmt.Sprintf("HEAD /api/lcards/{id} returns %d", status), func(t *testing.T) {
			t.Parallel()
			srv, db := newServer(t)
			const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
			if status == http.StatusOK {
				insertCard(t, db, id, "Title", "Description")
			}
			resp := testkit.Do(t, srv, testkit.DoOpts{Method: http.MethodHead, Path: "/api/lcards/" + id})
			testkit.AssertStatus(t, resp, status)
			if len(resp.Body) != 0 {
				t.Errorf("body: got %q, want empty", resp.Body)
			}
			if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
				t.Errorf("content-type: got %q, want JSON", ct)
			}
		})
	}

	t.Run("PATCH /api/lcards returns 405 with Allow header", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodPatch,
			Path:   "/api/lcards",
		})
		testkit.AssertStatus(t, resp, http.StatusMethodNotAllowed)
		if got := resp.Header.Get("Allow"); got != "GET, HEAD, POST" {
			t.Errorf("Allow: got %q, want %q", got, "GET, HEAD, POST")
		}
		testkit.AssertJSON(t, resp.Body, `{"code":"method_not_allowed"}`)
	})

	t.Run("PATCH /api/lcards/{id} returns 405 with Allow header", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodPatch,
			Path:   "/api/lcards/01a1730e-199d-7f9f-b59d-3bcd6f84066c",
		})
		testkit.AssertStatus(t, resp, http.StatusMethodNotAllowed)
		if got := resp.Header.Get("Allow"); got != "DELETE, GET, HEAD, PUT" {
			t.Errorf("Allow: got %q, want %q", got, "DELETE, GET, HEAD, PUT")
		}
		testkit.AssertJSON(t, resp.Body, `{"code":"method_not_allowed"}`)
	})
}

func TestList(t *testing.T) {
	t.Parallel()

	t.Run("empty DB", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodGet,
			Path:   "/api/lcards",
		})
		testkit.AssertStatus(t, resp, http.StatusOK)
		testkit.AssertJSON(t, resp.Body, `{"items":[],"next_cursor":null}`)
	})

	t.Run("two seeded rows newest first", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const (
			olderID = "01a1730e-199d-7f9f-b59d-3bcd6f84066a"
			newerID = "01a1730e-199d-7f9f-b59d-3bcd6f84066b"
		)
		insertCard(t, db, olderID, "Older Title", "Older Description")
		insertCard(t, db, newerID, "Newer Title", "Newer Description")

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodGet,
			Path:   "/api/lcards",
		})
		testkit.AssertStatus(t, resp, http.StatusOK)
		testkit.AssertJSON(t, resp.Body, `{
			"items": [
				{"id":"01a1730e-199d-7f9f-b59d-3bcd6f84066b","title":"Newer Title","description":"Newer Description","created_at":"2026-11-18T09:15:30.123456Z","updated_at":"2026-11-18T09:20:00Z"},
				{"id":"01a1730e-199d-7f9f-b59d-3bcd6f84066a","title":"Older Title","description":"Older Description","created_at":"2026-11-18T09:15:30.123456Z","updated_at":"2026-11-18T09:20:00Z"}
			],
			"next_cursor": null
		}`)
	})

	t.Run("walk pages with limit 1", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const (
			idA = "01a1730e-199d-7f9f-b59d-3bcd6f84066a"
			idB = "01a1730e-199d-7f9f-b59d-3bcd6f84066b"
			idC = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
		)
		insertCard(t, db, idA, "Title A", "Description A")
		insertCard(t, db, idB, "Title B", "Description B")
		insertCard(t, db, idC, "Title C", "Description C")

		wantPages := []string{
			`{"items":[{"id":"01a1730e-199d-7f9f-b59d-3bcd6f84066c","title":"Title C","description":"Description C","created_at":"2026-11-18T09:15:30.123456Z","updated_at":"2026-11-18T09:20:00Z"}],
				"next_cursor":"01a1730e-199d-7f9f-b59d-3bcd6f84066c"}`,
			`{"items":[{"id":"01a1730e-199d-7f9f-b59d-3bcd6f84066b","title":"Title B","description":"Description B","created_at":"2026-11-18T09:15:30.123456Z","updated_at":"2026-11-18T09:20:00Z"}],
				"next_cursor":"01a1730e-199d-7f9f-b59d-3bcd6f84066b"}`,
			`{"items":[{"id":"01a1730e-199d-7f9f-b59d-3bcd6f84066a","title":"Title A","description":"Description A","created_at":"2026-11-18T09:15:30.123456Z","updated_at":"2026-11-18T09:20:00Z"}],
				"next_cursor":null}`,
		}

		path := "/api/lcards?limit=1"
		var pages int
		for {
			if pages == len(wantPages) {
				t.Fatalf("pages: got more than %d, want %d", pages, len(wantPages))
			}

			resp := testkit.Do(t, srv, testkit.DoOpts{
				Method: http.MethodGet,
				Path:   path,
			})
			testkit.AssertStatus(t, resp, http.StatusOK)
			testkit.AssertJSON(t, resp.Body, wantPages[pages])
			pages++

			var got struct {
				NextCursor *string `json:"next_cursor"`
			}
			if err := json.Unmarshal(resp.Body, &got); err != nil {
				t.Fatalf("unmarshal response: %v\n%s", err, resp.Body)
			}
			if got.NextCursor == nil {
				break
			}
			path = "/api/lcards?limit=1&cursor=" + *got.NextCursor
		}
		if pages != len(wantPages) {
			t.Errorf("pages: got %v, want %v", pages, len(wantPages))
		}
	})

	t.Run("uppercase cursor", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const (
			idA = "01a1730e-199d-7f9f-b59d-3bcd6f84066a"
			idB = "01a1730e-199d-7f9f-b59d-3bcd6f84066b"
		)
		insertCard(t, db, idA, "Title A", "Description A")
		insertCard(t, db, idB, "Title B", "Description B")

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodGet,
			Path:   "/api/lcards?cursor=" + strings.ToUpper(idB),
		})
		testkit.AssertStatus(t, resp, http.StatusOK)
		testkit.AssertJSON(t, resp.Body, `{
			"items": [{"id":"01a1730e-199d-7f9f-b59d-3bcd6f84066a","title":"Title A","description":"Description A","created_at":"2026-11-18T09:15:30.123456Z","updated_at":"2026-11-18T09:20:00Z"}],
			"next_cursor": null
		}`)
	})

	t.Run("default limit", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		for range 21 {
			insertCard(t, db, uuid.Must(uuid.NewV7()).String(), "Title", "Description")
		}

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodGet,
			Path:   "/api/lcards",
		})
		testkit.AssertStatus(t, resp, http.StatusOK)

		var got struct {
			Items []struct {
				ID string `json:"id"`
			} `json:"items"`
			NextCursor *string `json:"next_cursor"`
		}
		if err := json.Unmarshal(resp.Body, &got); err != nil {
			t.Fatalf("unmarshal response: %v\n%s", err, resp.Body)
		}
		if len(got.Items) != 20 {
			t.Fatalf("items: got %v, want %v", len(got.Items), 20)
		}
		// The cursor must be the last item on the page, not just any non-null value.
		if got.NextCursor == nil {
			t.Fatalf("next_cursor: got %v, want %v", got.NextCursor, got.Items[19].ID)
		}
		if *got.NextCursor != got.Items[19].ID {
			t.Errorf("next_cursor: got %v, want %v", *got.NextCursor, got.Items[19].ID)
		}
	})

	invalid := []struct {
		name  string
		query string
		want  string
	}{
		{
			name:  "limit not an integer",
			query: "?limit=abc",
			want:  `{"code":"validation_error","errors":[{"field":"limit","code":"invalid_integer"}]}`,
		},
		{
			name:  "limit not canonical",
			query: "?limit=05",
			want:  `{"code":"validation_error","errors":[{"field":"limit","code":"invalid_integer"}]}`,
		},
		{
			name:  "limit overflow",
			query: "?limit=99999999999999999999999999999",
			want:  `{"code":"validation_error","errors":[{"field":"limit","code":"invalid_integer"}]}`,
		},
		{
			name:  "limit below min",
			query: "?limit=0",
			want:  `{"code":"validation_error","errors":[{"field":"limit","code":"out_of_range"}]}`,
		},
		{
			name:  "limit above max",
			query: "?limit=101",
			want:  `{"code":"validation_error","errors":[{"field":"limit","code":"out_of_range"}]}`,
		},
		{
			name:  "cursor not a uuid",
			query: "?cursor=not-a-uuid",
			want:  `{"code":"validation_error","errors":[{"field":"cursor","code":"invalid_cursor"}]}`,
		},
		{
			name:  "limit and cursor invalid",
			query: "?limit=0&cursor=bad",
			want: `{"code":"validation_error","errors":[
				{"field":"limit","code":"out_of_range"},
				{"field":"cursor","code":"invalid_cursor"}
			]}`,
		},
	}
	for _, tt := range invalid {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			srv, _ := newServer(t)

			resp := testkit.Do(t, srv, testkit.DoOpts{
				Method: http.MethodGet,
				Path:   "/api/lcards" + tt.query,
			})
			testkit.AssertStatus(t, resp, http.StatusBadRequest)
			testkit.AssertJSON(t, resp.Body, tt.want)
		})
	}
}

func TestGet(t *testing.T) {
	t.Parallel()

	t.Run("seeded row", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
		insertCard(t, db, id, "Title", "Description")

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodGet,
			Path:   "/api/lcards/" + id,
		})
		testkit.AssertStatus(t, resp, http.StatusOK)
		testkit.AssertJSON(t, resp.Body, `{
			"id": "01a1730e-199d-7f9f-b59d-3bcd6f84066c",
			"title": "Title",
			"description": "Description",
			"created_at": "2026-11-18T09:15:30.123456Z",
			"updated_at": "2026-11-18T09:20:00Z"
		}`)
	})

	t.Run("uppercase ID", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const (
			lowerID = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
			upperID = "01A1730E-199D-7F9F-B59D-3BCD6F84066C"
		)
		insertCard(t, db, lowerID, "Title", "Description")

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodGet,
			Path:   "/api/lcards/" + upperID,
		})
		testkit.AssertStatus(t, resp, http.StatusOK)
		testkit.AssertJSON(t, resp.Body, `{
			"id": "01a1730e-199d-7f9f-b59d-3bcd6f84066c",
			"title": "Title",
			"description": "Description",
			"created_at": "2026-11-18T09:15:30.123456Z",
			"updated_at": "2026-11-18T09:20:00Z"
		}`)
	})

	t.Run("missing UUIDv7", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodGet,
			Path:   "/api/lcards/01a1730e-199d-7f9f-b59d-3bcd6f84066c",
		})
		testkit.AssertStatus(t, resp, http.StatusNotFound)
		testkit.AssertJSON(t, resp.Body, `{"code":"not_found"}`)
	})

	t.Run("urn:uuid prefix", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodGet,
			Path:   "/api/lcards/urn:uuid:01a1730e-199d-7f9f-b59d-3bcd6f84066c",
		})
		testkit.AssertStatus(t, resp, http.StatusBadRequest)
		testkit.AssertJSON(t, resp.Body, `{"code":"validation_error","errors":[{"field":"id","code":"invalid_uuid7"}]}`)
	})
}

func TestCreate(t *testing.T) {
	t.Parallel()

	t.Run("valid", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPost,
			Path:        "/api/lcards",
			ContentType: "application/json",
			Body:        `{"title":"\t Cafe\u0301 Title \n","description":"\t Cafe\u0301 Description \n"}`,
		})
		testkit.AssertStatus(t, resp, http.StatusCreated)

		var got struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(resp.Body, &got); err != nil {
			t.Fatalf("unmarshal response: %v\n%s", err, resp.Body)
		}
		testkit.AssertJSON(t, resp.Body, fmt.Sprintf(`{"id":%q}`, got.ID))

		wantLocation := "/api/lcards/" + got.ID
		if location := resp.Header.Get("Location"); location != wantLocation {
			t.Errorf("location: got %q, want %q", location, wantLocation)
		}

		u, err := uuid.Parse(got.ID)
		if err != nil {
			t.Fatalf("parse id %q: %v", got.ID, err)
		}
		if u.Version() != 7 {
			t.Errorf("uuid version: got %d, want 7", u.Version())
		}

		wantRow := cardRow{
			Title:       "Caf\u00E9 Title",
			Description: "Caf\u00E9 Description",
		}
		if row := getCard(t, db, got.ID); row != wantRow {
			t.Errorf("stored row: got %+q, want %+q", row, wantRow)
		}
	})

	t.Run("mixed case JSON media type", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPost,
			Path:        "/api/lcards",
			ContentType: "Application/JSON; Charset=UTF-8",
			Body:        `{"title":"Title","description":"Description"}`,
		})
		testkit.AssertStatus(t, resp, http.StatusCreated)
	})

	t.Run("no Content-Type with a body", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodPost,
			Path:   "/api/lcards",
			Body:   `{"title":"Title","description":"Description"}`,
		})
		testkit.AssertStatus(t, resp, http.StatusUnsupportedMediaType)
		testkit.AssertJSON(t, resp.Body, `{"code":"unsupported_media_type"}`)
	})

	t.Run("malformed JSON", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPost,
			Path:        "/api/lcards",
			ContentType: "application/json",
			Body:        `{"title":`,
		})
		testkit.AssertStatus(t, resp, http.StatusBadRequest)
		testkit.AssertJSON(t, resp.Body, `{"code":"bind_error"}`)
	})

	// An empty body skips the media-type check (app/binder.go) and BindBody returns
	// early, so the request reaches validation with zero-value fields.
	t.Run("empty body", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPost,
			Path:        "/api/lcards",
			ContentType: "application/json",
			Body:        "",
		})
		testkit.AssertStatus(t, resp, http.StatusBadRequest)
		testkit.AssertJSON(t, resp.Body, `{
			"code": "validation_error",
			"errors": [
				{"field": "title", "code": "required"},
				{"field": "description", "code": "required"}
			]
		}`)
	})

	t.Run("XML body", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPost,
			Path:        "/api/lcards",
			ContentType: "application/xml",
			Body:        `<request><Title>Title</Title><Description>Description</Description></request>`,
		})
		testkit.AssertStatus(t, resp, http.StatusUnsupportedMediaType)
		testkit.AssertJSON(t, resp.Body, `{"code":"unsupported_media_type"}`)
	})

	t.Run("body over MaxBodyBytes", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPost,
			Path:        "/api/lcards",
			ContentType: "application/json",
			Body:        strings.Repeat("a", router.MaxBodyBytes+1),
		})
		testkit.AssertStatus(t, resp, http.StatusRequestEntityTooLarge)
		testkit.AssertJSON(t, resp.Body, `{"code":"payload_too_large"}`)
	})

	// Without a Content-Length the body-limit middleware cannot reject the
	// request up front; the limit is hit while the handler binds the body.
	t.Run("chunked body over MaxBodyBytes", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPost,
			Path:        "/api/lcards",
			ContentType: "application/json",
			Body:        strings.Repeat("a", router.MaxBodyBytes+1),
			Chunked:     true,
		})
		testkit.AssertStatus(t, resp, http.StatusRequestEntityTooLarge)
		testkit.AssertJSON(t, resp.Body, `{"code":"payload_too_large"}`)
	})
}

func TestUpdate(t *testing.T) {
	t.Parallel()

	t.Run("valid", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
		insertCard(t, db, id, "Old Title", "Old Description")

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPut,
			Path:        "/api/lcards/" + id,
			ContentType: "application/json",
			Body:        `{"title":"\t Cafe\u0301 New Title \n","description":"\t Cafe\u0301 New Description \n"}`,
		})
		testkit.AssertStatus(t, resp, http.StatusNoContent)
		if len(resp.Body) != 0 {
			t.Errorf("body: got %q, want empty", resp.Body)
		}

		wantRow := cardRow{
			Title:       "Caf\u00E9 New Title",
			Description: "Caf\u00E9 New Description",
		}
		if row := getCard(t, db, id); row != wantRow {
			t.Errorf("stored row: got %+q, want %+q", row, wantRow)
		}
	})

	t.Run("missing ID", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPut,
			Path:        "/api/lcards/01a1730e-199d-7f9f-b59d-3bcd6f84066c",
			ContentType: "application/json",
			Body:        `{"title":"Title","description":"Description"}`,
		})
		testkit.AssertStatus(t, resp, http.StatusNotFound)
		testkit.AssertJSON(t, resp.Body, `{"code":"not_found"}`)
	})

	t.Run("urn:uuid prefix", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPut,
			Path:        "/api/lcards/urn:uuid:01a1730e-199d-7f9f-b59d-3bcd6f84066c",
			ContentType: "application/json",
			Body:        `{"title":"Title","description":"Description"}`,
		})
		testkit.AssertStatus(t, resp, http.StatusBadRequest)
		testkit.AssertJSON(t, resp.Body, `{"code":"validation_error","errors":[{"field":"id","code":"invalid_uuid7"}]}`)
	})

	t.Run("XML body", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
		original := cardRow{
			Title:       "Original Title",
			Description: "Original Description",
		}
		insertCard(t, db, id, original.Title, original.Description)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPut,
			Path:        "/api/lcards/" + id,
			ContentType: "application/xml",
			Body:        `<request><Title>New Title</Title><Description>New Description</Description></request>`,
		})
		testkit.AssertStatus(t, resp, http.StatusUnsupportedMediaType)
		testkit.AssertJSON(t, resp.Body, `{"code":"unsupported_media_type"}`)

		if row := getCard(t, db, id); row != original {
			t.Errorf("stored row: got %+q, want %+q", row, original)
		}
	})

	t.Run("invalid field leaves row unchanged", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
		original := cardRow{
			Title:       "Original Title",
			Description: "Original Description",
		}
		insertCard(t, db, id, original.Title, original.Description)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPut,
			Path:        "/api/lcards/" + id,
			ContentType: "application/json",
			Body:        `{"title":"","description":"New Description"}`,
		})
		testkit.AssertStatus(t, resp, http.StatusBadRequest)
		testkit.AssertJSON(t, resp.Body, `{
			"code": "validation_error",
			"errors": [
				{"field": "title", "code": "required"}
			]
		}`)

		if row := getCard(t, db, id); row != original {
			t.Errorf("stored row: got %+q, want %+q", row, original)
		}
	})

	t.Run("chunked body over MaxBodyBytes", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
		original := cardRow{
			Title:       "Original Title",
			Description: "Original Description",
		}
		insertCard(t, db, id, original.Title, original.Description)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPut,
			Path:        "/api/lcards/" + id,
			ContentType: "application/json",
			Body:        strings.Repeat("a", router.MaxBodyBytes+1),
			Chunked:     true,
		})
		testkit.AssertStatus(t, resp, http.StatusRequestEntityTooLarge)
		testkit.AssertJSON(t, resp.Body, `{"code":"payload_too_large"}`)

		if row := getCard(t, db, id); row != original {
			t.Errorf("stored row: got %+q, want %+q", row, original)
		}
	})
}

func TestDelete(t *testing.T) {
	t.Parallel()

	t.Run("seeded row then second delete returns 404", func(t *testing.T) {
		t.Parallel()
		srv, db := newServer(t)

		const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
		insertCard(t, db, id, "Title", "Description")

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodDelete,
			Path:   "/api/lcards/" + id,
		})
		testkit.AssertStatus(t, resp, http.StatusNoContent)
		if len(resp.Body) != 0 {
			t.Errorf("first delete body: got %q, want empty", resp.Body)
		}
		if cardExists(t, db, id) {
			t.Errorf("card %s still exists after delete", id)
		}

		resp = testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodDelete,
			Path:   "/api/lcards/" + id,
		})
		testkit.AssertStatus(t, resp, http.StatusNotFound)
		testkit.AssertJSON(t, resp.Body, `{"code":"not_found"}`)
	})

	t.Run("urn:uuid prefix", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method: http.MethodDelete,
			Path:   "/api/lcards/urn:uuid:01a1730e-199d-7f9f-b59d-3bcd6f84066c",
		})
		testkit.AssertStatus(t, resp, http.StatusBadRequest)
		testkit.AssertJSON(t, resp.Body, `{"code":"validation_error","errors":[{"field":"id","code":"invalid_uuid7"}]}`)
	})
}

func TestLifecycle(t *testing.T) {
	t.Parallel()
	srv, _ := newServer(t)

	// 1. POST
	resp := testkit.Do(t, srv, testkit.DoOpts{
		Method:      http.MethodPost,
		Path:        "/api/lcards",
		ContentType: "application/json",
		Body:        `{"title":"Initial Title","description":"Initial Description"}`,
	})
	testkit.AssertStatus(t, resp, http.StatusCreated)
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(resp.Body, &created); err != nil {
		t.Fatalf("unmarshal POST response: %v\n%s", err, resp.Body)
	}

	location := resp.Header.Get("Location")
	if location == "" {
		t.Fatal("POST response: missing Location header")
	}

	path := "/api/lcards/" + created.ID

	// 2. GET after create, following the Location header
	resp = testkit.Do(t, srv, testkit.DoOpts{
		Method: http.MethodGet,
		Path:   location,
	})
	testkit.AssertStatus(t, resp, http.StatusOK)
	assertContent(t, resp.Body, cardContent{created.ID, "Initial Title", "Initial Description"})

	// 3. PUT
	resp = testkit.Do(t, srv, testkit.DoOpts{
		Method:      http.MethodPut,
		Path:        path,
		ContentType: "application/json",
		Body:        `{"title":"Updated Title","description":"Updated Description"}`,
	})
	testkit.AssertStatus(t, resp, http.StatusNoContent)
	if len(resp.Body) != 0 {
		t.Errorf("PUT body: got %q, want empty", resp.Body)
	}

	// 4. GET after update
	resp = testkit.Do(t, srv, testkit.DoOpts{
		Method: http.MethodGet,
		Path:   path,
	})
	testkit.AssertStatus(t, resp, http.StatusOK)
	assertContent(t, resp.Body, cardContent{created.ID, "Updated Title", "Updated Description"})

	// 5. DELETE
	resp = testkit.Do(t, srv, testkit.DoOpts{
		Method: http.MethodDelete,
		Path:   path,
	})
	testkit.AssertStatus(t, resp, http.StatusNoContent)
	if len(resp.Body) != 0 {
		t.Errorf("DELETE body: got %q, want empty", resp.Body)
	}

	// 6. GET after delete -> 404
	resp = testkit.Do(t, srv, testkit.DoOpts{
		Method: http.MethodGet,
		Path:   path,
	})
	testkit.AssertStatus(t, resp, http.StatusNotFound)
	testkit.AssertJSON(t, resp.Body, `{"code":"not_found"}`)
}

// Strict binding rejects any field a request body doesn't take, the card's
// read-only timestamps included, and the card stays as it was.
func TestUnknownRequestFields(t *testing.T) {
	t.Parallel()
	bodies := []struct {
		name string
		body string
	}{
		{"unknown field", `{"title":"Changed","description":"Changed description","extra":true}`},
		{"created_at", `{"title":"Changed","description":"Changed description","created_at":"2026-11-18T09:00:00Z"}`},
		{"updated_at", `{"title":"Changed","description":"Changed description","updated_at":"2026-11-18T09:00:00Z"}`},
	}
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, tt := range bodies {
			t.Run(method+" "+tt.name, func(t *testing.T) {
				t.Parallel()
				srv, db := newServer(t)
				const id = "01a1730e-199d-7f9f-b59d-3bcd6f84066c"
				original := cardRow{Title: "Original", Description: "Original description"}
				insertCard(t, db, id, original.Title, original.Description)
				path := "/api/lcards"
				if method == http.MethodPut {
					path += "/" + id
				}
				resp := testkit.Do(t, srv, testkit.DoOpts{
					Method:      method,
					Path:        path,
					ContentType: "application/json",
					Body:        tt.body,
				})
				testkit.AssertStatus(t, resp, http.StatusBadRequest)
				testkit.AssertJSON(t, resp.Body, `{"code":"bind_error"}`)
				if row := getCard(t, db, id); row != original {
					t.Errorf("stored row: got %+q, want %+q", row, original)
				}
				var count int
				if err := db.QueryRowContext(t.Context(), `SELECT count(*) FROM learning_cards`).Scan(&count); err != nil {
					t.Fatal(err)
				}
				if count != 1 {
					t.Errorf("card count: got %d, want 1", count)
				}
			})
		}
	}
}

func TestTimestamps(t *testing.T) {
	t.Parallel()

	t.Run("a created card's updated_at equals its created_at", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		id := createCard(t, srv, `{"title":"Title","description":"Description"}`)

		got := readTimes(t, getCardBody(t, srv, id))
		if !got.UpdatedAt.Equal(got.CreatedAt) {
			t.Errorf("updated_at: got %v, want created_at %v", got.UpdatedAt, got.CreatedAt)
		}
	})

	t.Run("an update moves updated_at and keeps created_at", func(t *testing.T) {
		t.Parallel()
		srv, _ := newServer(t)

		id := createCard(t, srv, `{"title":"Title","description":"Description"}`)
		before := readTimes(t, getCardBody(t, srv, id))

		resp := testkit.Do(t, srv, testkit.DoOpts{
			Method:      http.MethodPut,
			Path:        "/api/lcards/" + id,
			ContentType: "application/json",
			Body:        `{"title":"New Title","description":"New Description"}`,
		})
		testkit.AssertStatus(t, resp, http.StatusNoContent)

		after := readTimes(t, getCardBody(t, srv, id))
		if !after.CreatedAt.Equal(before.CreatedAt) {
			t.Errorf("created_at: got %v, want unchanged %v", after.CreatedAt, before.CreatedAt)
		}
		if !after.UpdatedAt.After(before.UpdatedAt) {
			t.Errorf("updated_at: got %v, want later than %v", after.UpdatedAt, before.UpdatedAt)
		}

		// The list gives the same timestamps as the card's own response.
		resp = testkit.Do(t, srv, testkit.DoOpts{Method: http.MethodGet, Path: "/api/lcards"})
		testkit.AssertStatus(t, resp, http.StatusOK)
		var page struct {
			Items []json.RawMessage `json:"items"`
		}
		if err := json.Unmarshal(resp.Body, &page); err != nil {
			t.Fatalf("unmarshal list: %v\n%s", err, resp.Body)
		}
		if len(page.Items) != 1 {
			t.Fatalf("items: got %d, want 1", len(page.Items))
		}
		if listed := readTimes(t, page.Items[0]); listed != after {
			t.Errorf("listed timestamps: got %+v, want %+v", listed, after)
		}
	})
}

// cardContent is what a card response holds besides its timestamps.
type cardContent struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func assertContent(t *testing.T, body []byte, want cardContent) {
	t.Helper()
	var got cardContent
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("unmarshal card: %v\n%s", err, body)
	}
	if got != want {
		t.Errorf("card: got %+v, want %+v", got, want)
	}
}

// cardTimes are a card response's timestamps.
type cardTimes struct {
	CreatedAt time.Time
	UpdatedAt time.Time
}

// readTimes returns the timestamps of the card in body, failing the test
// unless each is an RFC 3339 timestamp in UTC.
func readTimes(t *testing.T, body []byte) cardTimes {
	t.Helper()
	var raw struct {
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		t.Fatalf("unmarshal card: %v\n%s", err, body)
	}
	return cardTimes{
		CreatedAt: parseUTC(t, "created_at", raw.CreatedAt),
		UpdatedAt: parseUTC(t, "updated_at", raw.UpdatedAt),
	}
}

func parseUTC(t *testing.T, field, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		t.Fatalf("%s: %v", field, err)
	}
	if !strings.HasSuffix(value, "Z") {
		t.Errorf("%s: got %q, want UTC", field, value)
	}
	return parsed
}

// createCard creates a card from body through the API and returns its ID.
func createCard(t *testing.T, srv *httptest.Server, body string) string {
	t.Helper()
	resp := testkit.Do(t, srv, testkit.DoOpts{
		Method:      http.MethodPost,
		Path:        "/api/lcards",
		ContentType: "application/json",
		Body:        body,
	})
	testkit.AssertStatus(t, resp, http.StatusCreated)
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(resp.Body, &created); err != nil {
		t.Fatalf("unmarshal POST response: %v\n%s", err, resp.Body)
	}
	return created.ID
}

// getCardBody returns the body of the card's GET response.
func getCardBody(t *testing.T, srv *httptest.Server, id string) []byte {
	t.Helper()
	resp := testkit.Do(t, srv, testkit.DoOpts{Method: http.MethodGet, Path: "/api/lcards/" + id})
	testkit.AssertStatus(t, resp, http.StatusOK)
	return resp.Body
}

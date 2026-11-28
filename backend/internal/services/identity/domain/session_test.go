//go:build unit

package domain

import (
	"testing"
	"time"
)

var policy = SessionPolicy{
	IdleTimeout:     7 * 24 * time.Hour,
	AbsoluteTimeout: 30 * 24 * time.Hour,
}

var created = time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)

func TestSessionPolicy_ExpiresAt(t *testing.T) {
	t.Parallel()

	day := 24 * time.Hour
	for _, tt := range []struct {
		name     string
		lastSeen time.Duration // after creation
		want     time.Duration // after creation
	}{
		{"new session: the idle timeout", 0, 7 * day},
		{"used after a day: extended", day, 8 * day},
		{"used after 23 days: idle meets the absolute limit", 23 * day, 30 * day},
		{"used after 25 days: the absolute limit", 25 * day, 30 * day},
		{"used after 29 days: still the absolute limit", 29 * day, 30 * day},
	} {
		got := policy.ExpiresAt(created, created.Add(tt.lastSeen))
		if want := created.Add(tt.want); !got.Equal(want) {
			t.Errorf("%s: got %v, want %v", tt.name, got, want)
		}
	}

	// An absolute limit shorter than the idle timeout wins from the start.
	short := SessionPolicy{IdleTimeout: time.Hour, AbsoluteTimeout: time.Minute}
	if got := short.ExpiresAt(created, created); !got.Equal(created.Add(time.Minute)) {
		t.Errorf("short absolute limit: got %v", got)
	}
}

func TestSessionPolicy_Validate(t *testing.T) {
	t.Parallel()

	if err := policy.Validate(); err != nil {
		t.Errorf("valid policy: %v", err)
	}
	for _, p := range []SessionPolicy{
		{},
		{IdleTimeout: time.Hour},
		{IdleTimeout: -time.Hour, AbsoluteTimeout: time.Hour},
	} {
		if err := p.Validate(); err == nil {
			t.Errorf("%+v: want an error", p)
		}
	}
}

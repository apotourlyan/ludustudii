//go:build unit

package server

import (
	"context"
	"errors"
	"testing"
	"time"
)

type shutdownFunc func(context.Context) error

func (f shutdownFunc) Shutdown(ctx context.Context) error { return f(ctx) }

func TestDrain_CallsOnDrainBeforeDelay(t *testing.T) {
	t.Parallel()
	for _, delay := range []time.Duration{0, 40 * time.Millisecond} {
		t.Run(delay.String(), func(t *testing.T) {
			t.Parallel()
			calls := 0
			var calledAt time.Time
			drain(func(context.Context) {
				calls++
				calledAt = time.Now()
			}, delay)
			returnedAt := time.Now()
			if calls != 1 {
				t.Fatalf("OnDrain calls: %d, want 1", calls)
			}
			if waited := returnedAt.Sub(calledAt); waited < delay {
				t.Errorf("drain returned %v after OnDrain, want at least %v", waited, delay)
			}
		})
	}
}

func TestDrain_NilOnDrainWaitsForDelay(t *testing.T) {
	t.Parallel()
	const delay = 40 * time.Millisecond
	start := time.Now()
	drain(nil, delay)
	if elapsed := time.Since(start); elapsed < delay {
		t.Errorf("drain returned after %v, want at least %v", elapsed, delay)
	}
}

func TestShutdown_GracePeriod(t *testing.T) {
	t.Parallel()
	const timeout = time.Second
	err := shutdown(t.Context(), shutdownFunc(func(ctx context.Context) error {
		deadline, ok := ctx.Deadline()
		if !ok {
			t.Error("shutdown context has no deadline")
		} else if remaining := time.Until(deadline); remaining < timeout/2 || remaining > timeout {
			t.Errorf("shutdown grace period: %v, want approximately %v", remaining, timeout)
		}
		return nil
	}), timeout)
	if err != nil {
		t.Fatal(err)
	}
}

func TestShutdown_ServerError(t *testing.T) {
	t.Parallel()
	want := errors.New("shutdown failed")
	err := shutdown(t.Context(), shutdownFunc(func(context.Context) error { return want }), time.Second)
	if !errors.Is(err, want) {
		t.Fatalf("shutdown error: %v, want %v", err, want)
	}
}

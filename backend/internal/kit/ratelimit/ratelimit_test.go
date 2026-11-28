//go:build unit

package ratelimit

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

var start = time.Date(2026, 11, 28, 9, 0, 0, 0, time.UTC)

func TestParseLimit(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		in   string
		want Limit
	}{
		{"10/1m", Limit{10, time.Minute}},
		{"5/15m", Limit{5, 15 * time.Minute}},
		{"5/1h", Limit{5, time.Hour}},
		{"1/500ms", Limit{1, 500 * time.Millisecond}},
		{"100000/1s", Limit{100000, time.Second}},
	} {
		got, err := ParseLimit(tt.in)
		if err != nil || got != tt.want {
			t.Errorf("ParseLimit(%q): got %v, %v; want %v", tt.in, got, err, tt.want)
		}
		if again, err := ParseLimit(got.String()); err != nil || again != got {
			t.Errorf("ParseLimit(%q.String()): got %v, %v", tt.in, again, err)
		}
	}

	for _, in := range []string{"", "10", "/1m", "10/", "0/1m", "-1/1m", "+1/1m", "01/1m", "1.5/1m", "10/0s", "10/-1m", "10/1", "10/minute", " 10/1m", "10 /1m", "10/1m/2"} {
		if got, err := ParseLimit(in); err == nil {
			t.Errorf("ParseLimit(%q): got %v, want an error", in, got)
		}
	}
}

func TestLimit_Validate(t *testing.T) {
	t.Parallel()

	if err := (Limit{1, time.Second}).Validate(); err != nil {
		t.Errorf("valid limit: %v", err)
	}
	for _, l := range []Limit{{}, {0, time.Second}, {1, 0}, {1, -time.Second}} {
		if err := l.Validate(); err == nil {
			t.Errorf("%+v: want an error", l)
		}
	}
}

func TestKeyed_Allow(t *testing.T) {
	t.Parallel()

	k := NewKeyed(Limit{Count: 3, Per: time.Minute}) // a token every 20s
	for i := range 3 {
		if ok, _ := k.Allow("a", start); !ok {
			t.Fatalf("event %d refused within the burst", i+1)
		}
	}
	ok, wait := k.Allow("a", start)
	if ok || wait != 20*time.Second {
		t.Fatalf("over the burst: got %v, %v; want false, 20s", ok, wait)
	}
	// Other keys have their own buckets.
	if ok, _ := k.Allow("b", start); !ok {
		t.Fatal("another key was refused")
	}

	// A refused event takes nothing: after 15s, 5s remain.
	if ok, wait := k.Allow("a", start.Add(15*time.Second)); ok || wait != 5*time.Second {
		t.Fatalf("after 15s: got %v, %v; want false, 5s", ok, wait)
	}
	if ok, _ := k.Allow("a", start.Add(20*time.Second)); !ok {
		t.Fatal("refused after one token refilled")
	}
	if ok, wait := k.Allow("a", start.Add(20*time.Second)); ok || wait != 20*time.Second {
		t.Fatalf("after taking the refilled token: got %v, %v; want false, 20s", ok, wait)
	}
}

// The bucket refills at its rate up to its size, never beyond.
func TestKeyed_Refill(t *testing.T) {
	t.Parallel()

	k := NewKeyed(Limit{Count: 2, Per: time.Minute}) // a token every 30s
	k.Allow("a", start)
	k.Allow("a", start)
	later := start.Add(time.Hour)
	for i := range 2 {
		if ok, _ := k.Allow("a", later); !ok {
			t.Fatalf("event %d refused after a full refill", i+1)
		}
	}
	if ok, wait := k.Allow("a", later); ok || wait != 30*time.Second {
		t.Fatalf("over the burst after an hour: got %v, %v; want false, 30s", ok, wait)
	}
}

// Wait times that aren't whole seconds come back exactly; rounding them up
// is the caller's.
func TestKeyed_WaitFraction(t *testing.T) {
	t.Parallel()

	k := NewKeyed(Limit{Count: 3, Per: 10 * time.Second}) // a token every 3⅓s
	for range 3 {
		k.Allow("a", start)
	}
	_, wait := k.Allow("a", start)
	if wait < 3333*time.Millisecond || wait > 3334*time.Millisecond {
		t.Fatalf("wait: got %v, want about 3.333s", wait)
	}
}

func TestKeyed_CheckAndTake(t *testing.T) {
	t.Parallel()

	k := NewKeyed(Limit{Count: 2, Per: 10 * time.Minute}) // a token every 5m
	for range 5 {
		if ok, _ := k.Check("a", start); !ok {
			t.Fatal("check took a token")
		}
	}
	k.Take("a", start)
	if ok, _ := k.Check("a", start); !ok {
		t.Fatal("refused with a token left")
	}
	k.Take("a", start)
	ok, wait := k.Check("a", start)
	if ok || wait != 5*time.Minute {
		t.Fatalf("after two takes: got %v, %v; want false, 5m", ok, wait)
	}
	// Taking from an empty bucket doesn't push the refill back.
	k.Take("a", start)
	if ok, _ := k.Check("a", start.Add(5*time.Minute)); !ok {
		t.Fatal("refused once a token refilled")
	}
}

func TestKeyed_EvictsFullBuckets(t *testing.T) {
	t.Parallel()

	at := start.Add
	k := NewKeyed(Limit{Count: 2, Per: time.Minute}) // a token every 30s

	// The first call sweeps; afterwards a sweep runs at most once a minute.
	k.Allow("a", at(0))              // full again at 30s
	k.Allow("b", at(0))              // empty, full again at 1m
	k.Allow("b", at(0))              //
	k.Check("c", at(30*time.Second)) // full throughout
	if n := k.Len(); n != 3 {
		t.Fatalf("keys before a minute passed: got %d, want 3", n)
	}

	k.Allow("d", at(time.Minute)) // sweeps a, b and c, then adds d
	if n := k.Len(); n != 1 {
		t.Fatalf("keys after the sweep at 1m: got %d, want 1", n)
	}

	// The next sweep, at 2m, keeps a bucket still refilling.
	k.Allow("e", at(time.Minute))     // empty at 1m, full at 2m
	k.Allow("e", at(time.Minute))     //
	k.Allow("f", at(100*time.Second)) // empty at 1m40s, full at 2m40s
	k.Allow("f", at(100*time.Second)) //
	k.Check("g", at(2*time.Minute))   // sweeps d and e
	if _, kept := k.buckets["e"]; kept {
		t.Error("a full bucket was kept")
	}
	if _, kept := k.buckets["f"]; !kept {
		t.Error("a bucket still refilling was dropped")
	}

	// A dropped key starts again with a full bucket.
	for i := range 2 {
		if ok, _ := k.Allow("b", at(2*time.Minute)); !ok {
			t.Fatalf("event %d of an evicted key was refused", i+1)
		}
	}
}

func TestKeyed_Concurrent(t *testing.T) {
	t.Parallel()

	k := NewKeyed(Limit{Count: 100, Per: time.Hour})
	var wg sync.WaitGroup
	var mu sync.Mutex
	allowed := 0
	for i := range 8 {
		wg.Go(func() {
			for j := range 50 {
				now := start.Add(time.Duration(j) * time.Millisecond)
				if ok, _ := k.Allow("shared", now); ok {
					mu.Lock()
					allowed++
					mu.Unlock()
				}
				k.Check(fmt.Sprintf("own-%d", i), now)
			}
		})
	}
	wg.Wait()
	if allowed != 100 {
		t.Errorf("allowed: got %d, want exactly the burst of 100", allowed)
	}
}

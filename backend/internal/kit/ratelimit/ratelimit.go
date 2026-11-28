// Package ratelimit limits events per key, such as requests per client IP,
// with one token bucket from golang.org/x/time/rate for each key. Every call
// takes the current time, so tests drive the buckets with a fake clock.
package ratelimit

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// Limit allows Count events per Per for each key: a bucket of Count tokens
// that refills completely over Per.
type Limit struct {
	Count int
	Per   time.Duration
}

// ParseLimit parses "<count>/<duration>", such as "10/1m", where count is a
// positive decimal integer and duration a positive time.ParseDuration value.
func ParseLimit(s string) (Limit, error) {
	count, per, ok := strings.Cut(s, "/")
	if !ok {
		return Limit{}, fmt.Errorf("parse limit %q: want <count>/<duration>", s)
	}
	n, err := strconv.Atoi(count)
	if err != nil || n < 1 || strconv.Itoa(n) != count {
		return Limit{}, fmt.Errorf("parse limit %q: count must be a positive integer", s)
	}
	d, err := time.ParseDuration(per)
	if err != nil || d <= 0 {
		return Limit{}, fmt.Errorf("parse limit %q: duration must be positive, such as 1m", s)
	}
	return Limit{Count: n, Per: d}, nil
}

// String returns l in the form ParseLimit accepts.
func (l Limit) String() string {
	return strconv.Itoa(l.Count) + "/" + l.Per.String()
}

// Validate reports a limit that allows nothing.
func (l Limit) Validate() error {
	if l.Count < 1 || l.Per <= 0 {
		return errors.New("limit needs a positive count and duration")
	}
	return nil
}

// Keyed holds one bucket per key. A key's bucket is created full on its first
// use. Buckets that have refilled completely behave as new ones, so Keyed
// drops them, checking at most once per Limit.Per; memory then grows only
// with the keys used within that time. It is safe for concurrent use.
type Keyed struct {
	limit     Limit
	every     rate.Limit
	mu        sync.Mutex
	buckets   map[string]*rate.Limiter
	lastSweep time.Time
}

// NewKeyed returns an empty Keyed that applies l to every key.
func NewKeyed(l Limit) *Keyed {
	return &Keyed{
		limit:   l,
		every:   rate.Limit(float64(l.Count) / l.Per.Seconds()),
		buckets: make(map[string]*rate.Limiter),
	}
}

// Allow takes a token from key's bucket at now and reports whether there was
// one. When there wasn't, it returns how long until there is.
func (k *Keyed) Allow(key string, now time.Time) (bool, time.Duration) {
	b := k.bucket(key, now)
	if b.AllowN(now, 1) {
		return true, 0
	}
	return false, k.wait(b, now)
}

// Check reports whether key's bucket has a token at now, without taking it.
// When it hasn't, it returns how long until it has. Use it with Take to
// count only some events, such as failures, but refuse before any.
func (k *Keyed) Check(key string, now time.Time) (bool, time.Duration) {
	b := k.bucket(key, now)
	if b.TokensAt(now) >= 1 {
		return true, 0
	}
	return false, k.wait(b, now)
}

// Take takes a token from key's bucket at now, if it has one.
func (k *Keyed) Take(key string, now time.Time) {
	k.bucket(key, now).AllowN(now, 1)
}

// Len returns the number of keys with a bucket.
func (k *Keyed) Len() int {
	k.mu.Lock()
	defer k.mu.Unlock()
	return len(k.buckets)
}

func (k *Keyed) bucket(key string, now time.Time) *rate.Limiter {
	k.mu.Lock()
	defer k.mu.Unlock()
	if now.Sub(k.lastSweep) >= k.limit.Per {
		k.sweep(now)
	}
	b, ok := k.buckets[key]
	if !ok {
		b = rate.NewLimiter(k.every, k.limit.Count)
		// A new bucket is full as of now, not as of the zero time, so a
		// clock that starts anywhere behaves the same.
		b.SetLimitAt(now, k.every)
		k.buckets[key] = b
	}
	return b
}

// sweep drops the buckets that are full at now. The caller holds k.mu.
func (k *Keyed) sweep(now time.Time) {
	for key, b := range k.buckets {
		if b.TokensAt(now) >= float64(k.limit.Count) {
			delete(k.buckets, key)
		}
	}
	k.lastSweep = now
}

// wait returns how long until b has a whole token after now.
func (k *Keyed) wait(b *rate.Limiter, now time.Time) time.Duration {
	missing := 1 - b.TokensAt(now)
	return time.Duration(math.Ceil(missing / float64(k.every) * float64(time.Second)))
}

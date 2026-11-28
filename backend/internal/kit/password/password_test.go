//go:build unit

package password

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"
)

// cheap keeps the tests fast; production parameters are tested only for
// being the default (internal/infra/env).
var cheap = Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32}

// phc matches a hash under cheap: a 16-byte salt and a 32-byte key in
// standard base64 without padding.
var phc = regexp.MustCompile(`^\$argon2id\$v=19\$m=64,t=1,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$`)

func TestHash_Format(t *testing.T) {
	t.Parallel()

	for _, pw := range []string{"correct horse battery staple", "  spaces around  ", "Caf\u00E9 \U0001F600", ""} {
		encoded, err := Hash(pw, cheap)
		if err != nil {
			t.Fatalf("hash: %v", err)
		}
		if !phc.MatchString(encoded) {
			t.Errorf("encoded: got %q, want a PHC string under cheap", encoded)
		}
	}
}

func TestEncode(t *testing.T) {
	t.Parallel()

	got := encode(cheap, []byte("somesaltsomesalt"), []byte("0123456789abcdef0123456789abcdef"))
	const want = "$argon2id$v=19$m=64,t=1,p=1$c29tZXNhbHRzb21lc2FsdA$MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY"
	if got != want {
		t.Errorf("encode: got %q, want %q", got, want)
	}
}

func TestHash_SaltsDiffer(t *testing.T) {
	t.Parallel()

	a, errA := Hash("same password", cheap)
	b, errB := Hash("same password", cheap)
	if errA != nil || errB != nil {
		t.Fatalf("hash: %v, %v", errA, errB)
	}
	if a == b {
		t.Errorf("two hashes of one password are equal: %q", a)
	}
}

func TestHash_InvalidParams(t *testing.T) {
	t.Parallel()

	if _, err := Hash("pw", Params{}); err == nil {
		t.Fatal("expected an error for zero parameters")
	}
}

func TestParams_Validate(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name    string
		params  Params
		wantErr bool
	}{
		{"cheap", cheap, false},
		{"production defaults", Params{Memory: 19456, Iterations: 2, Parallelism: 1, SaltLength: 16, KeyLength: 32}, false},
		{"smallest", Params{Memory: 8, Iterations: 1, Parallelism: 1, SaltLength: MinSaltLength, KeyLength: MinKeyLength}, false},
		{"largest", Params{Memory: MaxMemory, Iterations: MaxIterations, Parallelism: 255, SaltLength: MaxSaltLength, KeyLength: MaxKeyLength}, false},
		{"zero", Params{}, true},
		{"memory below 8 per lane", Params{Memory: 31, Iterations: 1, Parallelism: 4, SaltLength: 16, KeyLength: 32}, true},
		{"memory over the maximum", Params{Memory: MaxMemory + 1, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32}, true},
		{"iterations over the maximum", Params{Memory: 64, Iterations: MaxIterations + 1, Parallelism: 1, SaltLength: 16, KeyLength: 32}, true},
		{"salt too short", Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: MinSaltLength - 1, KeyLength: 32}, true},
		{"salt too long", Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: MaxSaltLength + 1, KeyLength: 32}, true},
		{"key too short", Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: MinKeyLength - 1}, true},
		{"key too long", Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: MaxKeyLength + 1}, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if err := tt.params.Validate(); (err != nil) != tt.wantErr {
				t.Errorf("validate %v: got %v, want error %v", tt.params, err, tt.wantErr)
			}
		})
	}
}

func TestHasher(t *testing.T) {
	t.Parallel()

	h, err := NewHasher(cheap, 2)
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := h.Hash(t.Context(), "pw")
	if err != nil {
		t.Fatal(err)
	}
	if !phc.MatchString(encoded) {
		t.Errorf("encoded: got %q, want a PHC string under cheap", encoded)
	}
}

func TestNewHasher_Invalid(t *testing.T) {
	t.Parallel()

	if _, err := NewHasher(cheap, 0); err == nil {
		t.Error("expected an error for zero concurrency")
	}
	if _, err := NewHasher(Params{}, 1); err == nil {
		t.Error("expected an error for zero parameters")
	}
}

// A full Hasher makes callers wait, and a caller whose context ends while
// waiting gets its error without hashing.
func TestHasher_ConcurrencyCap(t *testing.T) {
	t.Parallel()

	h, err := NewHasher(cheap, 1)
	if err != nil {
		t.Fatal(err)
	}
	if err := h.acquire(t.Context()); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Millisecond)
	defer cancel()
	if _, err := h.Hash(ctx, "pw"); !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("hash while full: got %v, want DeadlineExceeded", err)
	}

	done := make(chan error, 1)
	go func() {
		_, err := h.Hash(t.Context(), "pw")
		done <- err
	}()
	select {
	case err := <-done:
		t.Fatalf("hash finished while the only slot was taken: %v", err)
	case <-time.After(20 * time.Millisecond):
	}
	h.release()
	if err := <-done; err != nil {
		t.Errorf("hash after release: %v", err)
	}
}

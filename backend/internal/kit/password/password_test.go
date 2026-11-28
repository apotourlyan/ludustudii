//go:build unit

package password

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

// cheap keeps the tests fast; production parameters are tested only for
// being the default (internal/infra/env).
var cheap = Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32}

func TestHash_RoundTrip(t *testing.T) {
	t.Parallel()

	for _, pw := range []string{"correct horse battery staple", "  spaces around  ", "Café \U0001F600", ""} {
		encoded, err := Hash(pw, cheap)
		if err != nil {
			t.Fatalf("hash: %v", err)
		}
		if !strings.HasPrefix(encoded, "$argon2id$v=19$m=64,t=1,p=1$") {
			t.Errorf("encoded: got %q, want the PHC prefix", encoded)
		}
		ok, err := Verify(pw, encoded)
		if err != nil || !ok {
			t.Errorf("verify %q: got %v, %v; want true, nil", pw, ok, err)
		}
		h, err := parse(encoded)
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		if h.params != cheap {
			t.Errorf("params: got %v, want %v", h.params, cheap)
		}
		if got := encode(h.params, h.salt, h.key); got != encoded {
			t.Errorf("re-encoded: got %q, want %q", got, encoded)
		}
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

func TestVerify_WrongPassword(t *testing.T) {
	t.Parallel()

	encoded, err := Hash("the right password", cheap)
	if err != nil {
		t.Fatal(err)
	}
	for _, pw := range []string{"the wrong password", "the right password ", "The right password", ""} {
		ok, err := Verify(pw, encoded)
		if err != nil || ok {
			t.Errorf("verify %q: got %v, %v; want false, nil", pw, ok, err)
		}
	}
}

// A known vector pins the encoding: the same password, salt and parameters
// always give this string.
func TestEncode_KnownVector(t *testing.T) {
	t.Parallel()

	const encoded = "$argon2id$v=19$m=64,t=1,p=1$c29tZXNhbHRzb21lc2FsdA$55PWTvddWPUD1GMbKxSff4ASfF85k9ibHJt4HlHQtBM"
	h, err := parse(encoded)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if string(h.salt) != "somesaltsomesalt" {
		t.Errorf("salt: got %q", h.salt)
	}
	if got := encode(h.params, h.salt, h.key); got != encoded {
		t.Errorf("re-encoded: got %q, want %q", got, encoded)
	}
	if ok, err := Verify("password", encoded); err != nil || !ok {
		t.Errorf("verify: got %v, %v; want true, nil", ok, err)
	}
}

func TestParse_Malformed(t *testing.T) {
	t.Parallel()

	const salt = "c29tZXNhbHRzb21lc2FsdA"                     // 16 bytes
	const key = "55PWTvddWPUD1GMbKxSff4ASfF85k9ibHJt4HlHQtBM" // 32 bytes
	valid := "$argon2id$v=19$m=64,t=1,p=1$" + salt + "$" + key
	if _, err := parse(valid); err != nil {
		t.Fatalf("valid hash rejected: %v", err)
	}

	for _, tt := range []struct{ name, encoded string }{
		{"empty", ""},
		{"no leading dollar", "argon2id$v=19$m=64,t=1,p=1$" + salt + "$" + key},
		{"too few fields", "$argon2id$v=19$m=64,t=1,p=1$" + salt},
		{"too many fields", valid + "$extra"},
		{"trailing dollar", valid + "$"},
		{"argon2i", "$argon2i$v=19$m=64,t=1,p=1$" + salt + "$" + key},
		{"argon2d", "$argon2d$v=19$m=64,t=1,p=1$" + salt + "$" + key},
		{"bcrypt", "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234"},
		{"version 16", "$argon2id$v=16$m=64,t=1,p=1$" + salt + "$" + key},
		{"no version", "$argon2id$m=64,t=1,p=1$" + salt + "$" + key + "$x"},
		{"parameters out of order", "$argon2id$v=19$t=1,m=64,p=1$" + salt + "$" + key},
		{"missing parameter", "$argon2id$v=19$m=64,t=1$" + salt + "$" + key},
		{"extra parameter", "$argon2id$v=19$m=64,t=1,p=1,k=1$" + salt + "$" + key},
		{"spaces in parameters", "$argon2id$v=19$m=64, t=1, p=1$" + salt + "$" + key},
		{"leading zero", "$argon2id$v=19$m=064,t=1,p=1$" + salt + "$" + key},
		{"plus sign", "$argon2id$v=19$m=+64,t=1,p=1$" + salt + "$" + key},
		{"negative", "$argon2id$v=19$m=64,t=-1,p=1$" + salt + "$" + key},
		{"empty value", "$argon2id$v=19$m=,t=1,p=1$" + salt + "$" + key},
		{"not a number", "$argon2id$v=19$m=lots,t=1,p=1$" + salt + "$" + key},
		{"memory overflows uint32", "$argon2id$v=19$m=4294967296,t=1,p=1$" + salt + "$" + key},
		{"parallelism overflows uint8", "$argon2id$v=19$m=4096,t=1,p=256$" + salt + "$" + key},
		{"zero iterations", "$argon2id$v=19$m=64,t=0,p=1$" + salt + "$" + key},
		{"zero parallelism", "$argon2id$v=19$m=64,t=1,p=0$" + salt + "$" + key},
		{"memory below 8 per lane", "$argon2id$v=19$m=15,t=1,p=2$" + salt + "$" + key},
		{"memory over the maximum", "$argon2id$v=19$m=4194305,t=1,p=1$" + salt + "$" + key},
		{"iterations over the maximum", "$argon2id$v=19$m=64,t=1025,p=1$" + salt + "$" + key},
		{"salt with padding", "$argon2id$v=19$m=64,t=1,p=1$" + salt + "==$" + key},
		{"salt in base64url", "$argon2id$v=19$m=64,t=1,p=1$" + salt + "$" + strings.ReplaceAll(key, "+", "-") + "-_"},
		{"salt not base64", "$argon2id$v=19$m=64,t=1,p=1$not*base64$" + key},
		{"salt too short", "$argon2id$v=19$m=64,t=1,p=1$c2FsdA$" + key},
		{"empty salt", "$argon2id$v=19$m=64,t=1,p=1$$" + key},
		{"key too short", "$argon2id$v=19$m=64,t=1,p=1$" + salt + "$a2V5"},
		{"empty key", "$argon2id$v=19$m=64,t=1,p=1$" + salt + "$"},
		{"line break in key", "$argon2id$v=19$m=64,t=1,p=1$" + salt + "$" + key[:20] + "\n" + key[20:]},
		{"line break in salt", "$argon2id$v=19$m=64,t=1,p=1$" + salt[:10] + "\r\n" + salt[10:] + "$" + key},
		{"non-canonical base64 trailing bits", "$argon2id$v=19$m=64,t=1,p=1$c29tZXNhbHRzb21lc2FsdB$" + key},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if _, err := parse(tt.encoded); !errors.Is(err, ErrMalformedHash) {
				t.Errorf("parse %q: got %v, want ErrMalformedHash", tt.encoded, err)
			}
			if _, err := Verify("pw", tt.encoded); !errors.Is(err, ErrMalformedHash) {
				t.Errorf("verify: got %v, want ErrMalformedHash", err)
			}
			if _, err := NeedsRehash(tt.encoded, cheap); !errors.Is(err, ErrMalformedHash) {
				t.Errorf("needs rehash: got %v, want ErrMalformedHash", err)
			}
		})
	}
}

func TestNeedsRehash(t *testing.T) {
	t.Parallel()

	encoded, err := Hash("pw", cheap)
	if err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		name   string
		change func(*Params)
		want   bool
	}{
		{"same parameters", func(*Params) {}, false},
		{"more memory", func(p *Params) { p.Memory = 128 }, true},
		{"less memory", func(p *Params) { p.Memory = 32 }, true},
		{"more iterations", func(p *Params) { p.Iterations = 2 }, true},
		{"more parallelism", func(p *Params) { p.Parallelism = 2 }, true},
		{"longer salt", func(p *Params) { p.SaltLength = 32 }, true},
		{"longer key", func(p *Params) { p.KeyLength = 64 }, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			p := cheap
			tt.change(&p)
			got, err := NeedsRehash(encoded, p)
			if err != nil || got != tt.want {
				t.Errorf("got %v, %v; want %v, nil", got, err, tt.want)
			}
		})
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

	ok, rehash, err := h.Verify(t.Context(), "pw", encoded)
	if err != nil || !ok || rehash {
		t.Errorf("verify: got %v, %v, %v; want true, false, nil", ok, rehash, err)
	}
	ok, rehash, err = h.Verify(t.Context(), "other", encoded)
	if err != nil || ok || rehash {
		t.Errorf("verify wrong password: got %v, %v, %v; want false, false, nil", ok, rehash, err)
	}

	stronger := cheap
	stronger.Iterations = 2
	h2, err := NewHasher(stronger, 1)
	if err != nil {
		t.Fatal(err)
	}
	ok, rehash, err = h2.Verify(t.Context(), "pw", encoded)
	if err != nil || !ok || !rehash {
		t.Errorf("verify outdated: got %v, %v, %v; want true, true, nil", ok, rehash, err)
	}
	// A wrong password never asks for a rehash, even with outdated parameters.
	ok, rehash, err = h2.Verify(t.Context(), "other", encoded)
	if err != nil || ok || rehash {
		t.Errorf("verify outdated wrong password: got %v, %v, %v; want false, false, nil", ok, rehash, err)
	}
	if _, _, err := h.Verify(t.Context(), "pw", "garbage"); !errors.Is(err, ErrMalformedHash) {
		t.Errorf("verify garbage: got %v, want ErrMalformedHash", err)
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
	if _, _, err := h.Verify(ctx, "pw", "garbage"); !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("verify while full: got %v, want DeadlineExceeded", err)
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

// FuzzParse checks that the parser never panics, and that whatever it
// accepts is canonical: encoding the parsed hash gives back the input.
func FuzzParse(f *testing.F) {
	f.Add("$argon2id$v=19$m=64,t=1,p=1$c29tZXNhbHRzb21lc2FsdA$55PWTvddWPUD1GMbKxSff4ASfF85k9ibHJt4HlHQtBM")
	f.Add("$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$55PWTvddWPUD1GMbKxSff4ASfF85k9ibHJt4HlHQtBM")
	f.Add("$argon2id$v=19$m=064,t=1,p=1$c29tZXNhbHRzb21lc2FsdA$55PWTvddWPUD1GMbKxSff4ASfF85k9ibHJt4HlHQtBM")
	f.Add("$argon2i$v=19$m=64,t=1,p=1$$")
	f.Add("$$$$$")
	f.Add("")
	f.Fuzz(func(t *testing.T, encoded string) {
		h, err := parse(encoded)
		if err != nil {
			if !errors.Is(err, ErrMalformedHash) {
				t.Fatalf("error does not wrap ErrMalformedHash: %v", err)
			}
			return
		}
		if err := h.params.Validate(); err != nil {
			t.Fatalf("accepted out-of-bounds parameters %v: %v", h.params, err)
		}
		if got := encode(h.params, h.salt, h.key); got != encoded {
			t.Fatalf("not canonical: parsed %q, re-encoded %q", encoded, got)
		}
	})
}

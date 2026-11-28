// Package password hashes and verifies passwords with argon2id, stored in the
// PHC string format:
//
//	$argon2id$v=19$m=19456,t=2,p=1$<salt>$<key>
//
// The salt and key are standard base64 without padding. It is the only package
// that uses golang.org/x/crypto.
package password

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Bounds for Params. Besides keeping configuration sane, they let Verify
// refuse a stored hash whose parameters would exhaust the server.
const (
	MinMemory     = 8       // KiB per lane, times Parallelism
	MaxMemory     = 1 << 22 // KiB, 4 GiB
	MaxIterations = 1 << 10
	MinSaltLength = 8
	MaxSaltLength = 64
	MinKeyLength  = 16
	MaxKeyLength  = 64
)

// ErrMalformedHash reports a stored hash that is not an argon2id PHC string
// this package accepts.
var ErrMalformedHash = errors.New("malformed argon2id hash")

// Params are the argon2id cost parameters and the salt and key sizes.
type Params struct {
	Memory      uint32 // KiB
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32 // bytes
	KeyLength   uint32 // bytes
}

// Validate reports every parameter outside its bounds: memory from
// MinMemory per lane to MaxMemory KiB, 1 to MaxIterations iterations,
// parallelism of at least 1, and salt and key lengths within their bounds.
func (p Params) Validate() error {
	var errs []error
	if p.Parallelism < 1 {
		errs = append(errs, errors.New("parallelism must be at least 1"))
	}
	if minMemory := MinMemory * max(uint32(p.Parallelism), 1); p.Memory < minMemory || p.Memory > MaxMemory {
		errs = append(errs, fmt.Errorf("memory must be %d to %d KiB, got %d", minMemory, MaxMemory, p.Memory))
	}
	if p.Iterations < 1 || p.Iterations > MaxIterations {
		errs = append(errs, fmt.Errorf("iterations must be 1 to %d, got %d", MaxIterations, p.Iterations))
	}
	if p.SaltLength < MinSaltLength || p.SaltLength > MaxSaltLength {
		errs = append(errs, fmt.Errorf("salt length must be %d to %d bytes, got %d", MinSaltLength, MaxSaltLength, p.SaltLength))
	}
	if p.KeyLength < MinKeyLength || p.KeyLength > MaxKeyLength {
		errs = append(errs, fmt.Errorf("key length must be %d to %d bytes, got %d", MinKeyLength, MaxKeyLength, p.KeyLength))
	}
	return errors.Join(errs...)
}

// String returns the parameters as they appear in a PHC string, with the salt
// and key sizes.
func (p Params) String() string {
	return fmt.Sprintf("m=%d,t=%d,p=%d,salt=%d,key=%d", p.Memory, p.Iterations, p.Parallelism, p.SaltLength, p.KeyLength)
}

// Hash returns the PHC string of password under p with a new random salt. It
// fails only for parameters that don't pass Validate.
func Hash(password string, p Params) (string, error) {
	if err := p.Validate(); err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	salt := make([]byte, p.SaltLength)
	_, _ = rand.Read(salt) // Never fails; see crypto/rand.Read.
	key := argon2.IDKey([]byte(password), salt, p.Iterations, p.Memory, p.Parallelism, p.KeyLength)
	return encode(p, salt, key), nil
}

// Verify reports whether password matches the PHC string encoded, comparing
// the keys in constant time. A malformed hash returns an error wrapping
// ErrMalformedHash.
func Verify(password, encoded string) (bool, error) {
	h, err := parse(encoded)
	if err != nil {
		return false, err
	}
	key := argon2.IDKey([]byte(password), h.salt, h.params.Iterations, h.params.Memory, h.params.Parallelism, h.params.KeyLength)
	return subtle.ConstantTimeCompare(key, h.key) == 1, nil
}

// NeedsRehash reports whether encoded was made with parameters other than p,
// so a successful login should store a new hash.
func NeedsRehash(encoded string, p Params) (bool, error) {
	h, err := parse(encoded)
	if err != nil {
		return false, err
	}
	return h.params != p, nil
}

// Hasher hashes and verifies passwords under configured parameters, with at
// most a fixed number of hashes running at once. Callers past the cap wait
// for a slot or for their context to end.
type Hasher struct {
	params Params
	slots  chan struct{}
}

// NewHasher returns a Hasher for p that runs at most concurrency hashes at
// once.
func NewHasher(p Params, concurrency int) (*Hasher, error) {
	err := p.Validate()
	if concurrency < 1 {
		err = errors.Join(err, fmt.Errorf("concurrency must be at least 1, got %d", concurrency))
	}
	if err != nil {
		return nil, fmt.Errorf("new hasher: %w", err)
	}
	return &Hasher{params: p, slots: make(chan struct{}, concurrency)}, nil
}

// Hash returns the PHC string of password under the Hasher's parameters.
func (h *Hasher) Hash(ctx context.Context, password string) (string, error) {
	if err := h.acquire(ctx); err != nil {
		return "", err
	}
	defer h.release()
	return Hash(password, h.params)
}

// Verify reports whether password matches encoded and, when it does, whether
// encoded was made with other parameters than the Hasher's.
func (h *Hasher) Verify(ctx context.Context, password, encoded string) (ok, rehash bool, err error) {
	if err := h.acquire(ctx); err != nil {
		return false, false, err
	}
	defer h.release()
	ok, err = Verify(password, encoded)
	if err != nil || !ok {
		return false, false, err
	}
	rehash, err = NeedsRehash(encoded, h.params)
	return ok, rehash, err
}

func (h *Hasher) acquire(ctx context.Context) error {
	select {
	case h.slots <- struct{}{}:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("wait for a hashing slot: %w", ctx.Err())
	}
}

func (h *Hasher) release() { <-h.slots }

const phcID = "argon2id"

var (
	phcVersion = "v=" + strconv.Itoa(argon2.Version)
	b64        = base64.RawStdEncoding.Strict()
)

type hash struct {
	params Params
	salt   []byte
	key    []byte
}

func encode(p Params, salt, key []byte) string {
	return fmt.Sprintf("$%s$%s$m=%d,t=%d,p=%d$%s$%s",
		phcID, phcVersion, p.Memory, p.Iterations, p.Parallelism,
		b64.EncodeToString(salt), b64.EncodeToString(key))
}

// parse accepts only the canonical form encode writes: the five fields in
// order, decimal numbers without signs or leading zeros, and strict base64,
// with every parameter within the bounds of Params.Validate. Parsing then
// encoding a hash returns it unchanged.
func parse(encoded string) (hash, error) {
	fields := strings.Split(encoded, "$")
	if len(fields) != 6 || fields[0] != "" {
		return hash{}, fmt.Errorf("%w: want 5 fields", ErrMalformedHash)
	}
	if fields[1] != phcID {
		return hash{}, fmt.Errorf("%w: algorithm %q", ErrMalformedHash, fields[1])
	}
	if fields[2] != phcVersion {
		return hash{}, fmt.Errorf("%w: version %q", ErrMalformedHash, fields[2])
	}
	params := strings.Split(fields[3], ",")
	if len(params) != 3 {
		return hash{}, fmt.Errorf("%w: want parameters m, t and p", ErrMalformedHash)
	}
	m, errM := parseParam(params[0], "m=", 32)
	t, errT := parseParam(params[1], "t=", 32)
	p, errP := parseParam(params[2], "p=", 8)
	if err := errors.Join(errM, errT, errP); err != nil {
		return hash{}, err
	}
	salt, errS := b64.DecodeString(fields[4])
	key, errK := b64.DecodeString(fields[5])
	// The decoder skips line breaks even in strict mode, so the decoded bytes
	// must encode back to exactly what was stored.
	if errS != nil || errK != nil ||
		b64.EncodeToString(salt) != fields[4] || b64.EncodeToString(key) != fields[5] {
		return hash{}, fmt.Errorf("%w: salt or key is not canonical base64", ErrMalformedHash)
	}
	h := hash{
		params: Params{
			Memory:      uint32(m),         // #nosec G115 -- Parsed with a 32-bit limit.
			Iterations:  uint32(t),         // #nosec G115 -- Parsed with a 32-bit limit.
			Parallelism: uint8(p),          // #nosec G115 -- Parsed with an 8-bit limit.
			SaltLength:  uint32(len(salt)), // #nosec G115 -- Decoded from a string shorter than a uint32 can count.
			KeyLength:   uint32(len(key)),  // #nosec G115 -- Decoded from a string shorter than a uint32 can count.
		},
		salt: salt,
		key:  key,
	}
	if err := h.params.Validate(); err != nil {
		return hash{}, fmt.Errorf("%w: %w", ErrMalformedHash, err)
	}
	return h, nil
}

// parseParam parses "<prefix><n>" where n is a canonical decimal that fits
// in bits.
func parseParam(s, prefix string, bits int) (uint64, error) {
	digits, ok := strings.CutPrefix(s, prefix)
	if !ok {
		return 0, fmt.Errorf("%w: want parameter %q", ErrMalformedHash, prefix)
	}
	n, err := strconv.ParseUint(digits, 10, bits)
	if err != nil || strconv.FormatUint(n, 10) != digits {
		return 0, fmt.Errorf("%w: parameter %q is not a canonical number", ErrMalformedHash, prefix)
	}
	return n, nil
}

// Package password hashes passwords with argon2id, stored in the PHC string
// format:
//
//	$argon2id$v=19$m=19456,t=2,p=1$<salt>$<key>
//
// The salt and key are standard base64 without padding. It is the only package
// that uses golang.org/x/crypto.
package password

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"

	"golang.org/x/crypto/argon2"
)

// Bounds for Params, which keep the configuration sane.
const (
	MinMemory     = 8       // KiB per lane, times Parallelism
	MaxMemory     = 1 << 22 // KiB, 4 GiB
	MaxIterations = 1 << 10
	MinSaltLength = 8
	MaxSaltLength = 64
	MinKeyLength  = 16
	MaxKeyLength  = 64
)

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

// Hasher hashes passwords under configured parameters, with at most a fixed
// number of hashes running at once. Callers past the cap wait
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

func encode(p Params, salt, key []byte) string {
	return fmt.Sprintf("$%s$%s$m=%d,t=%d,p=%d$%s$%s",
		phcID, phcVersion, p.Memory, p.Iterations, p.Parallelism,
		b64.EncodeToString(salt), b64.EncodeToString(key))
}

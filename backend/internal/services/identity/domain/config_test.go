//go:build unit

package domain

import (
	"strings"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit/password"
	"github.com/apotourlyan/ludustudii/internal/kit/ratelimit"
)

func TestConfig_Validate(t *testing.T) {
	t.Parallel()

	valid := Config{
		Password:               password.Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32},
		HashConcurrency:        1,
		Session:                policy,
		SessionCleanupInterval: time.Hour,
		LoginIPLimit:           ratelimit.Limit{Count: 10, Per: time.Minute},
		LoginAccountLimit:      ratelimit.Limit{Count: 5, Per: 15 * time.Minute},
		RegisterIPLimit:        ratelimit.Limit{Count: 5, Per: time.Hour},
	}
	if err := valid.Validate(); err != nil {
		t.Fatalf("valid config: %v", err)
	}

	err := Config{}.Validate()
	if err == nil {
		t.Fatal("zero config: want an error")
	}
	for _, want := range []string{"parallelism", "idle timeout", "hash concurrency", "cleanup interval", "login IP limit", "login account limit", "register IP limit"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("zero config error does not mention %q: %v", want, err)
		}
	}
}

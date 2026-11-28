//go:build unit

package env

import (
	"log/slog"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/apotourlyan/ludustudii/internal/infra/logging"
	"github.com/apotourlyan/ludustudii/internal/kit/password"
)

// setRequired sets the vars Load needs and clears the vars under test so the
// host environment cannot leak into a test.
func setRequired(t *testing.T) {
	t.Helper()
	t.Setenv(EnvDBConnectionString, "postgres://user:secret@localhost:5432/db")
	t.Setenv(EnvAppPort, "8080")
	t.Setenv(EnvAppAPIDocs, "")
	t.Setenv(EnvAppShutdownDrainDelay, "")
	t.Setenv(EnvLogLevel, "")
	t.Setenv(EnvLogFormat, "")
}

func TestLoad_AppPort(t *testing.T) {
	for _, tt := range []struct {
		port string
		want string
	}{
		{port: "1", want: "1"},
		{port: "8080", want: "8080"},
		{port: "65535", want: "65535"},
		{port: "08080", want: "8080"},
	} {
		t.Run(tt.port, func(t *testing.T) {
			setRequired(t)
			t.Setenv(EnvAppPort, tt.port)

			v, err := Load()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if v.AppPort != tt.want {
				t.Errorf("port: got %q, want %q", v.AppPort, tt.want)
			}
		})
	}
}

func TestLoad_AppPortErrors(t *testing.T) {
	for _, port := range []string{"", "abc", "http", "0", "-1", "65536", "999999999999999999999999", " 8080", "8080 ", "+8080", "80.5", "0x1f90"} {
		t.Run(port, func(t *testing.T) {
			setRequired(t)
			t.Setenv(EnvAppPort, port)
			t.Setenv(EnvAppAPIDocs, "invalid")

			v, err := Load()
			if err == nil {
				t.Fatalf("expected error, got vars %+v", v)
			}
			if v != nil {
				t.Error("expected nil vars for invalid configuration")
			}
			for _, name := range []string{EnvAppPort, EnvAppAPIDocs} {
				if !strings.Contains(err.Error(), name) {
					t.Errorf("error %q does not mention %s", err, name)
				}
			}
		})
	}
}

func TestLoad_APIDocs(t *testing.T) {
	tests := []struct {
		val  string
		want bool
	}{
		{val: "", want: DefaultAppAPIDocs},
		{val: "true", want: true},
		{val: "1", want: true},
		{val: "TRUE", want: true},
		{val: "false", want: false},
		{val: "0", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.val, func(t *testing.T) {
			setRequired(t)
			t.Setenv(EnvAppAPIDocs, tt.val)

			v, err := Load()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if v.AppAPIDocs != tt.want {
				t.Errorf("api docs: got %v, want %v", v.AppAPIDocs, tt.want)
			}
		})
	}
}

func TestLoad_APIDocsError(t *testing.T) {
	setRequired(t)
	t.Setenv(EnvAppAPIDocs, "yes")

	v, err := Load()
	if err == nil {
		t.Fatalf("expected error, got vars %+v", v)
	}
	if !strings.Contains(err.Error(), EnvAppAPIDocs) {
		t.Errorf("error %q does not mention %s", err, EnvAppAPIDocs)
	}
}

func TestLoad_LogDefaults(t *testing.T) {
	setRequired(t)

	v, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := v.LogLevel.Level(); got != slog.LevelInfo {
		t.Errorf("level: got %v, want %v", got, slog.LevelInfo)
	}
	if v.LogFormat != logging.FormatJSON {
		t.Errorf("format: got %v, want %v", v.LogFormat, logging.FormatJSON)
	}
}

func TestLoad_LogLevel(t *testing.T) {
	tests := []struct {
		val  string
		want slog.Level
	}{
		{val: "debug", want: slog.LevelDebug},
		{val: "DEBUG", want: slog.LevelDebug},
		{val: "Info", want: slog.LevelInfo},
		{val: "warn", want: slog.LevelWarn},
		{val: "error", want: slog.LevelError},
	}

	for _, tt := range tests {
		t.Run(tt.val, func(t *testing.T) {
			setRequired(t)
			t.Setenv(EnvLogLevel, tt.val)

			v, err := Load()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got := v.LogLevel.Level(); got != tt.want {
				t.Errorf("level: got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestLoad_LogFormat(t *testing.T) {
	tests := []struct {
		val  string
		want logging.Format
	}{
		{val: "json", want: logging.FormatJSON},
		{val: "text", want: logging.FormatText},
	}

	for _, tt := range tests {
		t.Run(tt.val, func(t *testing.T) {
			setRequired(t)
			t.Setenv(EnvLogFormat, tt.val)

			v, err := Load()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if v.LogFormat != tt.want {
				t.Errorf("format: got %v, want %v", v.LogFormat, tt.want)
			}
		})
	}
}

func TestLoad_LogErrors(t *testing.T) {
	tests := []struct {
		name     string
		level    string
		format   string
		wantErrs []string
	}{
		{name: "invalid level", level: "verbose", wantErrs: []string{EnvLogLevel}},
		{name: "invalid format", format: "xml", wantErrs: []string{EnvLogFormat}},
		{name: "format is case-sensitive", format: "JSON", wantErrs: []string{EnvLogFormat}},
		{name: "both collected", level: "loud", format: "yaml", wantErrs: []string{EnvLogLevel, EnvLogFormat}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setRequired(t)
			t.Setenv(EnvLogLevel, tt.level)
			t.Setenv(EnvLogFormat, tt.format)

			v, err := Load()
			if err == nil {
				t.Fatalf("expected error, got vars %+v", v)
			}
			for _, want := range tt.wantErrs {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error %q does not mention %s", err, want)
				}
			}
		})
	}
}

func TestVars_LogAttrs(t *testing.T) {
	setRequired(t)
	t.Setenv(EnvLogLevel, "warn")
	t.Setenv(EnvLogFormat, "text")
	t.Setenv(EnvAppAPIDocs, "true")

	v, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := map[string]string{}
	for _, a := range v.LogAttrs() {
		got[a.Key] = a.Value.String()
	}
	if got[EnvDBConnectionString] == "" || strings.Contains(got[EnvDBConnectionString], "secret") {
		t.Errorf("%s not redacted: %q", EnvDBConnectionString, got[EnvDBConnectionString])
	}
	if got[EnvLogLevel] != "WARN" {
		t.Errorf("%s: got %q, want %q", EnvLogLevel, got[EnvLogLevel], "WARN")
	}
	if got[EnvLogFormat] != "text" {
		t.Errorf("%s: got %q, want %q", EnvLogFormat, got[EnvLogFormat], "text")
	}
	if got[EnvAppAPIDocs] != "true" {
		t.Errorf("%s: got %q, want %q", EnvAppAPIDocs, got[EnvAppAPIDocs], "true")
	}
}

func TestVars_LogAttrs_QueryPassword(t *testing.T) {
	setRequired(t)
	t.Setenv(EnvDBConnectionString, "postgres://localhost:5432/db?user=user&password=secret&sslmode=disable")

	v, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	found := false
	for _, a := range v.LogAttrs() {
		if a.Key != EnvDBConnectionString {
			continue
		}
		found = true
		got := a.Value.String()
		if strings.Contains(got, "secret") {
			t.Errorf("%s not redacted: %q", EnvDBConnectionString, got)
		}
		if !strings.Contains(got, "sslmode=disable") {
			t.Errorf("%s lost other query parameters: %q", EnvDBConnectionString, got)
		}
	}
	if !found {
		t.Fatal("missing DB_CONNECTION log attribute")
	}
}

func TestLoad_ShutdownDrainDelay(t *testing.T) {
	for _, tc := range []struct {
		value string
		want  time.Duration
	}{
		{"", 0},
		{"0s", 0},
		{"250ms", 250 * time.Millisecond},
		{"5s", 5 * time.Second},
	} {
		t.Run(tc.value, func(t *testing.T) {
			setRequired(t)
			t.Setenv(EnvAppShutdownDrainDelay, tc.value)
			v, err := Load()
			if err != nil {
				t.Fatal(err)
			}
			if v.AppShutdownDrainDelay != tc.want {
				t.Errorf("drain delay: %v, want %v", v.AppShutdownDrainDelay, tc.want)
			}
			for _, attr := range v.LogAttrs() {
				if attr.Key == EnvAppShutdownDrainDelay && attr.Value.Duration() == tc.want {
					return
				}
			}
			t.Fatal("effective drain delay not logged")
		})
	}
}

func TestLoad_ShutdownDrainDelayErrorsCollected(t *testing.T) {
	setRequired(t)
	t.Setenv(EnvAppShutdownDrainDelay, "later")
	t.Setenv(EnvAppReadTimeout, "invalid")
	t.Setenv(EnvAppPort, "invalid")
	v, err := Load()
	if v != nil || err == nil {
		t.Fatalf("configuration: %v, error: %v", v, err)
	}
	for _, name := range []string{EnvAppShutdownDrainDelay, EnvAppReadTimeout, EnvAppPort} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("error %q does not mention %s", err, name)
		}
	}
}

var authNames = []string{
	EnvAuthArgon2Memory, EnvAuthArgon2Iterations, EnvAuthArgon2Parallelism,
	EnvAuthArgon2SaltLength, EnvAuthArgon2KeyLength, EnvAuthHashConcurrency,
	EnvAuthSessionIdleTimeout, EnvAuthSessionAbsoluteTimeout,
	EnvAuthSessionTouchInterval,
}

// clearAuth unsets the AUTH_ variables, which the devcontainer sets to cheap
// development values.
func clearAuth(t *testing.T) {
	t.Helper()
	for _, name := range authNames {
		t.Setenv(name, "")
	}
}

// The production values are in effect by default: tests elsewhere use cheap
// ones (ADR 0046).
func TestLoad_AuthDefaults(t *testing.T) {
	setRequired(t)
	clearAuth(t)

	v, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got, want := v.PasswordParams(), (password.Params{Memory: 19456, Iterations: 2, Parallelism: 1, SaltLength: 16, KeyLength: 32}); got != want {
		t.Errorf("argon2id: got %v, want %v", got, want)
	}
	if v.AuthHashConcurrency != runtime.NumCPU() {
		t.Errorf("hash concurrency: got %d, want %d", v.AuthHashConcurrency, runtime.NumCPU())
	}
	for name, tt := range map[string]struct{ got, want time.Duration }{
		"idle timeout":     {v.AuthSessionIdleTimeout, 7 * 24 * time.Hour},
		"absolute timeout": {v.AuthSessionAbsoluteTimeout, 30 * 24 * time.Hour},
		"touch interval":   {v.AuthSessionTouchInterval, time.Minute},
	} {
		if tt.got != tt.want {
			t.Errorf("%s: got %v, want %v", name, tt.got, tt.want)
		}
	}
}

func TestLoad_Auth(t *testing.T) {
	setRequired(t)
	clearAuth(t)
	for name, value := range map[string]string{
		EnvAuthArgon2Memory:           "64",
		EnvAuthArgon2Iterations:       "1",
		EnvAuthArgon2Parallelism:      "2",
		EnvAuthArgon2SaltLength:       "32",
		EnvAuthArgon2KeyLength:        "64",
		EnvAuthHashConcurrency:        "3",
		EnvAuthSessionIdleTimeout:     "1h",
		EnvAuthSessionAbsoluteTimeout: "2h",
		EnvAuthSessionTouchInterval:   "5s",
	} {
		t.Setenv(name, value)
	}

	v, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got, want := v.PasswordParams(), (password.Params{Memory: 64, Iterations: 1, Parallelism: 2, SaltLength: 32, KeyLength: 64}); got != want {
		t.Errorf("argon2id: got %v, want %v", got, want)
	}
	if v.AuthHashConcurrency != 3 || v.AuthSessionIdleTimeout != time.Hour || v.AuthSessionAbsoluteTimeout != 2*time.Hour ||
		v.AuthSessionTouchInterval != 5*time.Second {
		t.Errorf("sessions: got %+v", v)
	}

	attrs := map[string]string{}
	for _, a := range v.LogAttrs() {
		attrs[a.Key] = a.Value.String()
	}
	for name, want := range map[string]string{EnvAuthArgon2Memory: "64", EnvAuthSessionIdleTimeout: "1h0m0s"} {
		if attrs[name] != want {
			t.Errorf("log attr %s: got %q, want %q", name, attrs[name], want)
		}
	}
}

func TestLoad_AuthErrors(t *testing.T) {
	for _, tt := range []struct{ name, value, mention string }{
		{EnvAuthArgon2Memory, "lots", EnvAuthArgon2Memory},
		{EnvAuthArgon2Memory, "-1", EnvAuthArgon2Memory},
		{EnvAuthArgon2Memory, "4294967296", EnvAuthArgon2Memory},
		{EnvAuthArgon2Memory, "4", "memory"},
		{EnvAuthArgon2Iterations, "0", "iterations"},
		{EnvAuthArgon2Parallelism, "0", "parallelism"},
		{EnvAuthArgon2Parallelism, "256", EnvAuthArgon2Parallelism},
		{EnvAuthArgon2SaltLength, "4", "salt length"},
		{EnvAuthArgon2KeyLength, "8", "key length"},
		{EnvAuthHashConcurrency, "0", EnvAuthHashConcurrency},
		{EnvAuthHashConcurrency, "many", EnvAuthHashConcurrency},
		{EnvAuthSessionIdleTimeout, "7d", EnvAuthSessionIdleTimeout},
		{EnvAuthSessionAbsoluteTimeout, "0s", EnvAuthSessionAbsoluteTimeout},
		{EnvAuthSessionTouchInterval, "-1m", EnvAuthSessionTouchInterval},
	} {
		t.Run(tt.name+"="+tt.value, func(t *testing.T) {
			setRequired(t)
			clearAuth(t)
			t.Setenv(tt.name, tt.value)
			t.Setenv(EnvAppAPIDocs, "invalid")

			v, err := Load()
			if err == nil {
				t.Fatalf("expected error, got vars %+v", v)
			}
			for _, want := range []string{tt.mention, EnvAppAPIDocs} {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error %q does not mention %s", err, want)
				}
			}
		})
	}
}

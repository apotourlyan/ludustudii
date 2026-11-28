//go:build unit

// Package contract checks that the identity sanitizers and validators agree:
// whatever the sanitizers produce fails validation only for the reasons the
// client can fix, never for not being canonical.
package contract

import (
	"errors"
	"strings"
	"testing"
	"unicode"
	"unicode/utf8"

	"github.com/apotourlyan/ludustudii/internal/kit/validator"
	"github.com/apotourlyan/ludustudii/internal/services/identity/domain"
)

func FuzzValidateCanonicalEmail(f *testing.F) {
	f.Add("")
	f.Add("   ")
	f.Add("armen@example.com")
	f.Add("  Armen@Example.COM ")
	f.Add("RENÉ@EXAMPLE.COM")
	f.Add("İstanbul@example.com") // İ lowercases to i + U+0307
	f.Add("K@example.com")        // Kelvin sign lowercases to k
	f.Add("a@b@c")
	f.Add("@")
	f.Add(strings.Repeat("A", 252) + "@b")
	f.Add(strings.Repeat("A", 253) + "@b")
	f.Fuzz(func(t *testing.T, in string) {
		// encoding/json never produces invalid UTF-8
		in = strings.ToValidUTF8(in, "�")
		out := domain.CanonicalEmail(in)
		if again := domain.CanonicalEmail(out); again != out {
			t.Fatalf("not idempotent: %q -> %q -> %q", in, out, again)
		}

		var wantCode string
		local, host, _ := strings.Cut(out, "@")
		switch {
		case out == "":
			wantCode = validator.CodeRequired
		case utf8.RuneCountInString(out) > domain.EmailMaxLength:
			wantCode = validator.CodeMaxLength
		case local == "" || host == "" || strings.Count(out, "@") != 1:
			wantCode = domain.CodeInvalidFormat
		}
		checkCode(t, "email", domain.ValidateEmail(out), wantCode, in, out)
	})
}

func FuzzValidateCanonicalPassword(f *testing.F) {
	f.Add("")
	f.Add("correct horse battery staple")
	f.Add("  spaces at both ends  ")
	f.Add("Café Café Café Café")
	f.Add("tab\there and long enough")
	f.Add("invalid \xff UTF-8, long enough")
	f.Add(strings.Repeat("é", 128))
	f.Add(strings.Repeat("é", 128)) // 256 code points before NFC, 128 after
	f.Add(strings.Repeat("a", 129))
	f.Fuzz(func(t *testing.T, in string) {
		in = strings.ToValidUTF8(in, "�")
		out := domain.CanonicalPassword(in)
		if again := domain.CanonicalPassword(out); again != out {
			t.Fatalf("not idempotent: %q -> %q -> %q", in, out, again)
		}

		var wantCode string
		n := utf8.RuneCountInString(out)
		switch {
		case out == "":
			wantCode = validator.CodeRequired
		case strings.ContainsFunc(out, func(r rune) bool { return unicode.Is(unicode.Cc, r) || r == utf8.RuneError }):
			wantCode = domain.CodeInvalidCharacters
		case n < domain.PasswordMinLength:
			wantCode = validator.CodeMinLength
		case n > domain.PasswordMaxLength:
			wantCode = validator.CodeMaxLength
		}
		checkCode(t, "password", domain.ValidatePassword(out), wantCode, in, out)
	})
}

func checkCode(t *testing.T, field string, err error, wantCode, in, out string) {
	t.Helper()
	if wantCode == "" {
		if err != nil {
			t.Errorf("%s: input %q sanitized %q: got %v, want nil", field, in, out, err)
		}
		return
	}
	fe, ok := errors.AsType[*validator.FieldError](err)
	if !ok {
		t.Errorf("%s: input %q sanitized %q: got %v, want *validator.FieldError", field, in, out, err)
		return
	}
	if fe.Field != field || fe.Code != wantCode {
		t.Errorf("%s: input %q sanitized %q: got %s/%s, want %s/%s", field, in, out, fe.Field, fe.Code, field, wantCode)
	}
}

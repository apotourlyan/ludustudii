//go:build unit

package domain

import (
	"errors"
	"strings"
	"testing"

	"github.com/apotourlyan/ludustudii/internal/kit/validator"
)

func TestCanonicalEmail(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct{ in, want string }{
		{"armen@example.com", "armen@example.com"},
		{"  Armen@Example.COM \n", "armen@example.com"},
		{"RenÉ@example.com", "rené@example.com"},
		{"René@example.com", "rené@example.com"}, // decomposed é
		{"RENÉ@EXAMPLE.COM", "rené@example.com"}, // decomposed É, lowercased then composed
		{" x@y ", "x@y"},
	} {
		if got := CanonicalEmail(tt.in); got != tt.want {
			t.Errorf("CanonicalEmail(%q): got %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestCanonicalPassword(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct{ in, want string }{
		{"  spaces stay  ", "  spaces stay  "},
		{"Café Café Café", "Café Café Café"},
		{"MixedCase", "MixedCase"},
	} {
		if got := CanonicalPassword(tt.in); got != tt.want {
			t.Errorf("CanonicalPassword(%q): got %q, want %q", tt.in, got, tt.want)
		}
	}
}

type validation struct {
	name     string
	val      string
	wantCode string
	wantErr  error
}

func checkValidation(t *testing.T, field string, validate func(string) error, tests []validation) {
	t.Helper()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := validate(tt.val)
			if tt.wantCode == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			fe, ok := errors.AsType[*validator.FieldError](err)
			if !ok {
				t.Fatalf("error: got %v, want *validator.FieldError", err)
			}
			if fe.Field != field || fe.Code != tt.wantCode {
				t.Errorf("field error: got %s/%s, want %s/%s", fe.Field, fe.Code, field, tt.wantCode)
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Errorf("err: got %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateEmail(t *testing.T) {
	t.Parallel()

	local := strings.Repeat("a", EmailMaxLength-len("@b"))
	checkValidation(t, "email", ValidateEmail, []validation{
		{name: "simple", val: "armen@example.com"},
		{name: "shortest", val: "a@b"},
		{name: "no dot in domain", val: "armen@localhost"},
		{name: "non-ASCII", val: "rené@examplé.com"},
		{name: "spaces inside", val: "a b@c d"},
		{name: "at max length", val: local + "@b"},
		{name: "at max length in runes", val: strings.Repeat("é", EmailMaxLength-2) + "@b"},
		{name: "untrimmed", val: " a@b", wantCode: validator.CodeUntrimmed},
		{name: "not NFC", val: "rené@b", wantCode: validator.CodeNormalized},
		{name: "uppercase", val: "Armen@example.com", wantCode: validator.CodeNormalized, wantErr: ErrNotLowercase},
		{name: "empty", val: "", wantCode: validator.CodeRequired},
		{name: "over max length", val: "a" + local + "@b", wantCode: validator.CodeMaxLength},
		{name: "no @", val: "armen.example.com", wantCode: CodeInvalidFormat, wantErr: ErrInvalidFormat},
		{name: "two @", val: "a@b@c", wantCode: CodeInvalidFormat},
		{name: "nothing before @", val: "@example.com", wantCode: CodeInvalidFormat},
		{name: "nothing after @", val: "armen@", wantCode: CodeInvalidFormat},
		{name: "only @", val: "@", wantCode: CodeInvalidFormat},
	})
}

func TestValidatePassword(t *testing.T) {
	t.Parallel()

	checkValidation(t, "password", ValidatePassword, []validation{
		{name: "at min length", val: strings.Repeat("a", PasswordMinLength)},
		{name: "at max length", val: strings.Repeat("a", PasswordMaxLength)},
		{name: "at max length in runes", val: strings.Repeat("\U0001F600", PasswordMaxLength)},
		{name: "spaces at the ends", val: "  correct horse battery  "},
		{name: "only spaces", val: strings.Repeat(" ", PasswordMinLength)},
		{name: "non-breaking and other spaces", val: "pass word is long enough"},
		{name: "printable symbols", val: `!"#$%&'()*+,-./:;<=>?@[\]^_{|}~`},
		{name: "not NFC", val: "Café is a long password", wantCode: validator.CodeNormalized},
		{name: "empty", val: "", wantCode: validator.CodeRequired},
		{name: "tab", val: "correct\thorse battery", wantCode: CodeInvalidCharacters, wantErr: ErrInvalidCharacters},
		{name: "newline", val: "correct horse battery\n", wantCode: CodeInvalidCharacters},
		{name: "NUL", val: "correct horse\x00battery", wantCode: CodeInvalidCharacters},
		{name: "DEL", val: "correct horse\x7fbattery", wantCode: CodeInvalidCharacters},
		{name: "C1 control", val: "correct horse\u0085battery", wantCode: CodeInvalidCharacters},
		{name: "replacement character", val: "correct horse�battery", wantCode: CodeInvalidCharacters},
		{name: "characters checked before length", val: "\x00", wantCode: CodeInvalidCharacters},
		{name: "under min length", val: strings.Repeat("a", PasswordMinLength-1), wantCode: validator.CodeMinLength},
		{name: "under min length in runes", val: strings.Repeat("é", PasswordMinLength-1), wantCode: validator.CodeMinLength},
		{name: "over max length", val: strings.Repeat("a", PasswordMaxLength+1), wantCode: validator.CodeMaxLength},
	})
}

func TestValidateLoginEmail(t *testing.T) {
	t.Parallel()

	checkValidation(t, "email", ValidateLoginEmail, []validation{
		{name: "valid", val: "armen@example.com"},
		{name: "no @ is left to the lookup", val: "armen"},
		{name: "at max length", val: strings.Repeat("a", EmailMaxLength)},
		{name: "empty", val: "", wantCode: validator.CodeRequired},
		{name: "over max length", val: strings.Repeat("a", EmailMaxLength+1), wantCode: validator.CodeMaxLength},
	})
}

func TestValidateLoginPassword(t *testing.T) {
	t.Parallel()

	checkValidation(t, "password", ValidateLoginPassword, []validation{
		{name: "short, from before a rule change", val: "short"},
		{name: "control characters", val: "a\tb"},
		{name: "at max length", val: strings.Repeat("a", PasswordMaxLength)},
		{name: "empty", val: "", wantCode: validator.CodeRequired},
		{name: "over max length", val: strings.Repeat("a", PasswordMaxLength+1), wantCode: validator.CodeMaxLength},
	})
}

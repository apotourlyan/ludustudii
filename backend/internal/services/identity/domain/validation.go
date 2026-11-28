package domain

import (
	"errors"
	"fmt"
	"strings"
	"unicode"

	"github.com/apotourlyan/ludustudii/internal/kit/sanitizer"
	"github.com/apotourlyan/ludustudii/internal/kit/validator"
	"golang.org/x/text/unicode/norm"
)

// Length limits in code points. EmailMaxLength is the longest address SMTP
// carries; the password limits bound what a new password may be.
const (
	EmailMaxLength    = 254
	PasswordMinLength = 15
	PasswordMaxLength = 128
)

// Field error codes of the identity endpoints.
const (
	CodeInvalidFormat     = "invalid_format"
	CodeInvalidCharacters = "invalid_characters"
	CodeTaken             = "taken"
)

// Errors wrapped by the identity field errors.
var (
	ErrInvalidFormat     = errors.New("is not in a valid format")
	ErrInvalidCharacters = errors.New("contains characters that are not allowed")
	ErrNotLowercase      = errors.New("is not lowercase")
)

// CanonicalEmail returns the form an email is stored and compared in: NFC,
// trimmed and lowercased.
func CanonicalEmail(val string) string {
	// Lowercasing can leave a string outside NFC, so it is normalized again.
	return norm.NFC.String(strings.ToLower(sanitizer.String(val)))
}

// CanonicalPassword returns a password as it is hashed: in NFC, so the same
// characters typed on two devices match, but never trimmed.
func CanonicalPassword(val string) string {
	return sanitizer.Normalize(val)
}

// ValidateEmail checks an email for a new account: canonical (see
// CanonicalEmail), not empty, at most EmailMaxLength code points, and one @
// with text on both sides. It returns the first failed check as a
// *validator.FieldError for the "email" field.
func ValidateEmail(val string) error {
	const field = "email"
	if err := validator.Trimmed(field, val); err != nil {
		return err
	}
	if err := validator.Normalized(field, val); err != nil {
		return err
	}
	if val != strings.ToLower(val) {
		return validator.NewFieldError(field, validator.CodeNormalized,
			fmt.Errorf("%q: %w", field, ErrNotLowercase))
	}
	if err := validator.Required(field, val); err != nil {
		return err
	}
	if err := validator.MaxLength(field, val, EmailMaxLength); err != nil {
		return err
	}
	local, domain, ok := strings.Cut(val, "@")
	if !ok || local == "" || domain == "" || strings.Contains(domain, "@") {
		return validator.NewFieldError(field, CodeInvalidFormat,
			fmt.Errorf("%q: %w", field, ErrInvalidFormat))
	}
	return nil
}

// ValidatePassword checks a new password: in NFC, not empty, without
// control characters (Unicode category Cc) or U+FFFD, and from
// PasswordMinLength to PasswordMaxLength code points. Spaces, at the ends
// too, are allowed. It returns the first failed check as a
// *validator.FieldError for the "password" field.
func ValidatePassword(val string) error {
	const field = "password"
	if err := validator.Normalized(field, val); err != nil {
		return err
	}
	if err := validator.Required(field, val); err != nil {
		return err
	}
	if strings.ContainsFunc(val, disallowedInPassword) {
		return validator.NewFieldError(field, CodeInvalidCharacters,
			fmt.Errorf("%q: %w", field, ErrInvalidCharacters))
	}
	if err := validator.MinLength(field, val, PasswordMinLength); err != nil {
		return err
	}
	if err := validator.MaxLength(field, val, PasswordMaxLength); err != nil {
		return err
	}
	return nil
}

// disallowedInPassword reports control characters and U+FFFD, which stands in
// for invalid UTF-8.
func disallowedInPassword(r rune) bool {
	return unicode.Is(unicode.Cc, r) || r == unicode.ReplacementChar
}

// ValidateLoginEmail checks the email of a login only for being present and
// at most EmailMaxLength code points. An email that couldn't belong to an
// account fails as invalid credentials instead.
func ValidateLoginEmail(val string) error {
	if err := validator.Required("email", val); err != nil {
		return err
	}
	return validator.MaxLength("email", val, EmailMaxLength)
}

// ValidateLoginPassword checks the password of a login only for being present
// and at most PasswordMaxLength code points, so rules tightened later never
// lock out an account with an older password.
func ValidateLoginPassword(val string) error {
	if err := validator.Required("password", val); err != nil {
		return err
	}
	return validator.MaxLength("password", val, PasswordMaxLength)
}

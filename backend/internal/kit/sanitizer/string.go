// Package sanitizer normalizes user input before it is validated.
package sanitizer

import (
	"strings"

	"golang.org/x/text/unicode/norm"
)

// String returns val in Unicode NFC with leading and trailing white space
// removed, so the result passes validator.Normalized and validator.Trimmed.
func String(val string) string {
	return strings.TrimSpace(norm.NFC.String(val))
}

// Normalize returns val in Unicode NFC, white space included, so the result
// passes validator.Normalized. Use it for input kept as typed, such as a
// password.
func Normalize(val string) string {
	return norm.NFC.String(val)
}

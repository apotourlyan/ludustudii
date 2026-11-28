// Package domain holds the rules, limits and configuration shared by the
// identity endpoints.
package domain

import "errors"

// URL paths of the identity resources.
const (
	UsersPath = "/api/users"
)

// ErrEmailTaken reports a registration for an email that has an account.
var ErrEmailTaken = errors.New("email is taken")

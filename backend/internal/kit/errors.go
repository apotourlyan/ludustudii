// Package kit defines errors shared by services.
package kit

import "errors"

// ErrNotFound is the shared storage error for a missing resource.
var ErrNotFound = errors.New("not found")

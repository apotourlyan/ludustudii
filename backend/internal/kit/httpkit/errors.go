package httpkit

import (
	"net/http"

	"github.com/apotourlyan/ludustudii/internal/kit/erresp"
)

// Validation reports field validation failures, retaining their causes.
func Validation(err error) error {
	return &StatusError{Code: http.StatusBadRequest, Err: err, Response: erresp.Validation(err)}
}

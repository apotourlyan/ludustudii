package httpkit

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/apotourlyan/ludustudii/internal/kit/erresp"
)

// Validation reports field validation failures, retaining their causes.
func Validation(err error) error {
	return &StatusError{Code: http.StatusBadRequest, Err: err, Response: erresp.Validation(err)}
}

// TooManyRequests reports a request over a rate limit that may be retried
// after retryAfter, sent in Retry-After as whole seconds, rounded up and at
// least 1.
func TooManyRequests(retryAfter time.Duration) error {
	seconds := max(int64(math.Ceil(retryAfter.Seconds())), 1)
	return &StatusError{
		Code:     http.StatusTooManyRequests,
		Response: erresp.TooManyRequests(),
		Header:   http.Header{"Retry-After": {strconv.FormatInt(seconds, 10)}},
	}
}

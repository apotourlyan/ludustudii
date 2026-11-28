package httpkit

import (
	"net"
	"net/http"
)

// ClientIP returns the address of the connection's peer without its port.
// Headers such as X-Forwarded-For are ignored: anyone can forge them, and no
// proxy is trusted.
func ClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

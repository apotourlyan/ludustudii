# 0047. Cookie sessions and cross-site request protection

- Status: Accepted
- Date: 2026-11-28
- Tags: back-end, security, api

## Context

After a login ([0046](0046-accounts-and-passwords.md)), every request must
prove who sent it. The client app is served from the API's origin
([0003](0003-self-contained-server-binary.md)), so a cookie can carry that
proof, and browser script never needs to handle it.

The common alternative is a signed token (JWT): any service with the key
checks it without a lookup. Its cost is revocation: a token stays valid
until it expires, which leads to short-lived access tokens, refresh tokens,
and a decision on where the browser keeps them, where script can read them.
The lookup it saves matters with many services or heavy traffic; there is
one binary, and the planned gateway can check sessions once for the
services behind it.

A cookie brings its own threat: the browser attaches it to requests that
another site triggers (cross-site request forgery).

## Decision

- **Sessions are opaque tokens stored server-side.** A token is 32 random
  bytes from `crypto/rand`. The `identity` service's `sessions` table keeps
  its SHA-256 hash, never the token, with the user, the creation time, the
  last use and the expiry. A fast hash suffices: unlike a password, the
  token can't be guessed.
- **The token lives only in a cookie**: named with the `__Host-` prefix, and
  `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, so script can't read it
  and no subdomain can set it. It never appears in a response body.
- **Sessions end by idle time and by age.** Each has an idle timeout,
  extended as it's used (recording the last use at most once a minute, not
  on every request), and an absolute limit. Expired rows are deleted
  periodically.
- **Sessions are a resource.** Logging in is `POST /api/sessions`, which
  returns the session (its ID, its times and its user) and sets the cookie;
  registration does the same. Logging out is `DELETE /api/sessions/current`,
  which deletes it and expires the cookie, and succeeds without a session
  too. A session's ID names it, for a later list of sessions; only the
  token authenticates.
- **Every login creates a new session**, and deletes the one its request
  carried, if any, so a token planted before login is worthless after it.
- **Middleware resolves the session** to the user's ID in the request
  context; a `kit` helper reads it, and handlers pass it on explicitly.
  Every `/api` route requires a session except registration, login and
  logout; without one, the answer is 401 `unauthenticated`, distinct from a
  failed login's `invalid_credentials`. Neither sends `WWW-Authenticate`:
  cookie sessions have no registered scheme.
- **Storage is behind an interface** in the `identity` service, with a
  PostgreSQL implementation. Redis comes with the gateway.
- **Cross-site requests can't change anything:**
  - `SameSite=Lax` keeps the cookie off requests other sites trigger in the
    background, and sends it on top-level navigations, which use GET.
  - So GET and HEAD never change state.
  - `http.CrossOriginProtection` rejects unsafe methods (POST, PUT, PATCH,
    DELETE) from any other origin, by `Sec-Fetch-Site` or `Origin`, with a
    JSON 403 `cross_origin_request`.
  - JSON-only bodies ([0009](0009-strict-json-request-binding.md)) stay as a
    backstop: other sites can't send them without a preflight.
  - The API sends no CORS headers. An origin trusted later is listed
    explicitly, never reflected from the request.
- **No `/api` response is cached**: they all depend on who asks, so every
  one is `Cache-Control: no-store`.

## Alternatives considered

- **JWTs.** No lookup, but no revocation before expiry, and the refresh
  machinery that compensates for it.
- **A token in `localStorage`, sent as a header.** No CSRF, since nothing is
  sent automatically, but any injected script can read and exfiltrate it.
- **CSRF tokens.** The classic defense, but per-session state and plumbing
  in every client and test, for what the browser checks now provide.
- **Plain-text tokens in the table.** Simpler, but a leaked database or
  backup would hold working sessions.
- **Redis now.** Faster lookups and native expiry, but one more container
  before anything needs it: the lookup is one indexed query.

## Consequences

- Logout, and later "log out everywhere" and a password change, end
  sessions at once: they delete rows.
- Each request costs one indexed lookup; writes are rare.
- The cookie needs a secure context: HTTPS when deployed. Browsers treat
  `http://localhost` as secure, which local development and the browser
  tests rely on.
- When the gateway exists, it checks sessions and passes the user's
  identity to the services behind it; they never see the cookie.
- Learning cards start requiring a session together with their ownership
  (a later record). Until then, their routes stay open.

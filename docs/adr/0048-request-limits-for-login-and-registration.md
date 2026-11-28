# 0048. Request limits for login and registration

- Status: Accepted
- Date: 2026-11-28
- Tags: back-end, security, api

## Context

Login is where attackers try passwords: most often credential stuffing,
replaying email and password pairs leaked from other sites, and sometimes
guessing one account's password from many machines. Registration can be
abused to create accounts in bulk, or to probe which emails exist
([0046](0046-accounts-and-passwords.md) accepts that it reveals them).
Every attempt also costs an argon2id hash: memory and CPU.

The server runs as one instance. A shared store for counters (Redis) comes
with the gateway.

## Decision

- **Login is limited per client IP and per account.** Per IP stops one
  client trying many accounts; per account stops many clients trying one.
  The per-account limit counts failed logins.
- **Registration is limited per client IP.**
- **Limits slow down, they never lock.** A limited request gets 429
  `too_many_requests` with `Retry-After`, and the limit clears with time.
  No account is locked, which would let anyone lock out its owner.
- **Limits are token buckets from `golang.org/x/time/rate`**, one per key,
  in memory. The map of keys and the eviction of idle ones are ours. The
  package takes the current time as an argument (`AllowN(now, n)`), so tests
  pass a fake clock.
- **The limits are configuration**
  ([0018](0018-configuration-from-environment-variables.md)), with
  production values by default. Development and tests set them generously:
  browser tests register users from one address.
- **The client IP is the connection's address.** Trusting a proxy's
  `X-Forwarded-For` comes with the first deployment behind one, as a
  configured list of trusted proxies; the header is forged easily by anyone
  else.
- The cap on concurrent hashes (0046) stays independent of these limits.

## Alternatives considered

- **Our own token bucket.** A few dozen lines, but `x/time/rate` is
  maintained and widely used, and
  [0002](0002-standard-library-first-minimal-dependencies.md) prefers
  `golang.org/x` modules to owning code like this.
- **Account lockout after N failures.** Stops guessing, but hands every
  attacker a way to lock users out.
- **A CAPTCHA.** Effective against bots, but a third party in the login
  flow, and friction for every user.
- **Counters in Redis now.** Shared across instances and kept across
  restarts, but there is one instance, and losing counters on restart costs
  little.

## Consequences

- `golang.org/x/time` becomes a runtime dependency, small and with no
  dependencies of its own.
- Each instance counts on its own and forgets on restart; behind the
  gateway the counters move to Redis.
- Until a trusted proxy list exists, a deployment behind a proxy would see
  every client as the proxy's address. It must be configured before such a
  deployment.
- Limits that are too tight show up as 429s in browser tests, which is why
  they are configured per environment.

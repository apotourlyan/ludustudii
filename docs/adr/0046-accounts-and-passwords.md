# 0046. Accounts and passwords

- Status: Accepted
- Date: 2026-11-28
- Tags: back-end, security, api

## Context

The app has no users: every card belongs to whoever reaches the server.
Anyone may sign up, so each person needs an account that only they can use,
and the server must store something that proves a password without storing
the password. A stolen database is the threat to plan for: then the
attacker guesses passwords offline, at the speed of their own hardware, and
no request limit applies.

Accounts could come from an external identity provider (Keycloak, Zitadel,
Auth0) instead. That means a new container or an outside service, an OIDC
flow and its configuration, against
[0002](0002-standard-library-first-minimal-dependencies.md). Password
storage itself is well understood; the risk lies in the details below.

No email can be sent yet, so an address can't be verified, and a forgotten
password can't be reset by email.

## Decision

- **Accounts are built in.** A new `identity` service owns the `users`
  table. As [0001](0001-single-binary-services-as-packages.md) decides, it
  is a package (`internal/services/identity`) in the one binary, not a
  separate deployable. Registration is `POST /api/users`, which also logs the new user in
  (sessions: the next record); `GET /api/users/me` returns the current
  user. No endpoint exposes other users.
- **The email is the login name.** It is stored canonical: NFC, trimmed and
  lowercased, under a unique constraint, so `Armen@` and `armen@` are one
  account. Its check is deliberately loose: one `@` with text on both
  sides, and a maximum length. It isn't verified until email sending
  exists; `email_verified_at` stays empty until then.
- **Passwords are hashed with argon2id** (`golang.org/x/crypto/argon2`),
  with a random salt per password, and stored in the self-describing PHC
  format (`$argon2id$v=19$m=…,t=…,p=…$salt$hash`). Hashes are compared in
  constant time. The parameters are configuration: production values by
  default, cheap ones in tests. A successful login whose hash has outdated
  parameters rehashes the password it was given.
- **Passwords are stored as typed.** This is an exception to
  [0008](0008-canonicalize-text-input-before-validating.md): a password is
  normalized to NFC, so the same characters typed on two devices match, but
  never trimmed. Any printable character is allowed, spaces included;
  control characters and U+FFFD (the trace of invalid UTF-8) are rejected.
  The rules are a minimum and a maximum length in code points, and no
  composition rules.
- **The rules apply when a password is set**, at registration (and later
  on a change or a reset). Login checks only that a password is present and
  within the maximum length, so tightening the rules never locks out an
  existing account.
- **A failed login doesn't say why.** An unknown email and a wrong password
  get the same answer, `invalid_credentials`, and take the same time: for an
  unknown email the hash is checked against a fixed dummy hash.
- **Hashing is bounded.** Each hash costs memory and CPU, so a cap on
  concurrent hashes keeps a burst of logins from exhausting the server,
  whatever request limits let through.

## Alternatives considered

- **An external identity provider.** Proven, with verification, recovery
  and MFA included, but a container or a third party to run, an OIDC flow
  to integrate, and the part of the system worth understanding moves out of
  it.
- **bcrypt.** A complete API in `x/crypto`, so no encoding code to own, but
  it isn't memory-hard and ignores bytes past 72.
- **Usernames instead of emails.** Nothing to canonicalize, but no address
  for verification and recovery later.
- **An email kept case-sensitive.** Correct by the standard, but no real
  provider distinguishes case, and two accounts that look the same are a
  support problem and a phishing opening.
- **Registration that never says an email is taken** ("check your inbox").
  Doesn't reveal which emails have accounts, but needs email sending.
  Until then, `taken` is a field error, and request limits slow
  enumeration.

## Consequences

- `golang.org/x/crypto` becomes a runtime dependency: argon2 has no
  standard library equivalent, and getting it wrong is the risk 0002
  allows for. The PHC encoding, parsing and comparison are code we own and
  test, fuzzing the parser.
- Registration reveals whether an email has an account. This is accepted
  until email verification exists.
- A forgotten password can't be recovered until reset by email exists.
- Parameters can be raised at any time; existing hashes move over as their
  owners log in.
- Tests stay fast because their hashing parameters are cheap; production
  parameters are tested only for being in effect by default.

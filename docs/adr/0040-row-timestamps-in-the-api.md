# 0040. Row timestamps in the API

- Status: Accepted
- Date: 2026-11-18
- Tags: back-end, front-end, api

## Context

[0016](0016-row-metadata-set-in-store-sql.md) keeps `created_at` and
`updated_at` internal "until a feature needs them". The cards overview now
needs them: it marks cards created or changed in the last few minutes, so a
user who has just added or edited cards finds them at a glance, in place of
a success notification.

The client could instead remember which cards it changed itself. That needs
no API change, but it misses changes made in another tab or on another
device, and it forgets everything on a reload.

## Decision

- **Card responses include `created_at` and `updated_at`**, as RFC 3339
  timestamps in UTC (`format: date-time`), in single-card responses and in
  list items. They are read-only: request bodies don't take them, and
  strict binding ([0009](0009-strict-json-request-binding.md)) rejects them.
- **The values are the database's** ([0016](0016-row-metadata-set-in-store-sql.md)):
  `updated_at` changes with every update, and equals `created_at` until the
  first one.
- **Other resources expose their timestamps the same way** when a feature
  needs them, not before.
- **The client compares them with its own clock.** For a window of minutes,
  the usual difference between a device's clock and the server's doesn't
  matter; the client doesn't correct for it.

This amends 0016: card timestamps are part of the API.

## Alternatives considered

- **The client remembers its own changes.** No API change, but blind to
  other tabs and devices, and lost on reload.
- **A server-computed flag** (`recently_changed`). No clock comparison on
  the client, but the window becomes an API decision, and the flag goes
  stale in a cached response.
- **Correct for clock skew** with the response's `Date` header. Exact, but
  needless for a window of minutes.

## Consequences

- Adding the fields is backward compatible for readers; the generated client
  types gain them.
- The timestamps become part of the contract: their names and meaning can't
  change without a breaking change.
- A device whose clock is off by minutes shows the overview's marks too long
  or too briefly.

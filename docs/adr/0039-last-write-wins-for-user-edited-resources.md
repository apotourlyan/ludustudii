# 0039. Last write wins for user-edited resources

- Status: Accepted
- Date: 2026-11-18
- Tags: back-end, front-end, api, database
- Supersedes: [0010](archive/0010-optimistic-concurrency-with-etag-and-if-match.md)

## Context

[0010](archive/0010-optimistic-concurrency-with-etag-and-if-match.md) gave every
user-editable resource a `version`, exposed as a strong `ETag`, and made
updates and deletes require `If-Match`, answering 428 without it and 412 when
it's stale. It protects against a lost update: two writers changing the same
resource, the second silently overwriting the first.

The application has one writer per resource. A user's cards, and later their
decks and courses, are edited only by that user; nothing is shared or
collaborative. The only lost update left is one user with the same resource
open in two tabs or on two devices, saving an older copy over a newer one.
That's rare, and what is lost is the user's own earlier edit.

The protection isn't free, and its cost grows with the application:

- every new editable resource needs the version column, the ETag headers, the
  `If-Match` parsing, the 428 and 412 responses, and tests for each;
- every client form keeps the version it opened with, and needs a conflict
  interface after a 412 (reload the latest, or keep its own and overwrite),
  which would be the most complex part of the edit flow, for its rarest case;
- the fake backend reproduces all of it
  ([0032](0032-stateful-fake-backend-with-msw.md)).

## Decision

- **The last write wins.** An update replaces the stored resource, and a
  delete removes it, whatever the client read before.
- **No versions, no conditional requests.** Resources have no `version`
  field and responses no `ETag`. Requests take no `If-Match`, and the API has
  no 428 or 412 responses: `precondition_required` and `precondition_failed`
  are removed from the error codes.
- **Row timestamps stay** ([0016](0016-row-metadata-set-in-store-sql.md)):
  every `UPDATE` sets `updated_at = now()`.
- **The accepted risk:** a user with a resource open in two places can
  overwrite a newer edit of their own with an older copy, without being
  told.

Revisit this if a resource becomes shared between users, edited by a
background process at the same time as by its user, or synchronized between
devices without the user saving.

## Alternatives considered

- **Keep 0010.** Correct and already built for cards, but the cost of every
  future resource and of the conflict interface buys protection against a
  case that hardly happens in a one-user application.
- **Keep versions on the server, make `If-Match` optional.** Clients that
  send it stay protected, but the client app wouldn't send it, so the
  server keeps the machinery for no caller.
- **Warn instead of reject**, by comparing `updated_at` on the client before
  saving. Less machinery, but still a conflict interface, and a race between
  the check and the write.

## Consequences

- New editable resources follow cards without versions: an `UPDATE` sets the
  data and `updated_at`; a `DELETE` removes the row.
- The client app's forms submit their values without a version, and there is
  no conflict state to handle.
- Removing the error codes and the `version` field is a breaking API change.
  The client app is the only client, and it changes in the same pull request.
- The `version` column is dropped by a new migration
  ([0017](0017-migration-policy.md)).
- A lost update is now possible, silently, as described above.

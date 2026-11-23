# 0038. Form validation errors

- Status: Accepted, Amended by [0041](0041-feedback-toasts-page-states-and-navigation-progress.md) (the placeholder line becomes a toast)
- Date: 2026-11-17
- Tags: front-end, forms, api

## Context

The API reports invalid input as `400 validation_error` with per-field
codes and no messages ([0025](0025-error-responses.md)): `{ "field":
"title", "code": "max_length" }`. The client app checks the same rules in
its forms before submitting, with its own messages, so the API's field
errors arrive only when the two disagree: a rule the client lacks, a limit
that changed on one side, or a difference in how text is canonicalized
(JavaScript's `trim()` keeps U+0085, Go's `strings.TrimSpace` strips it).
When that happens, the card form shows one generic line next to its
buttons, and the user can't tell which field is wrong.

Every future form faces the same questions: where a server's verdict on a
field appears, how it reads, when it goes away, and where the user's
attention goes after a failed submit. Most code is written by coding
agents, so the answer has to be one rule, not a choice per form.

## Decision

- **Validation produces codes.** A form's own checks return the API's
  field codes (`required`, `max_length`), the same values the API sends.
  Text is chosen from a code in one place per module: a wording function
  from a field and a code to the message ("Title is required"). Client and
  server errors therefore read the same, and translation later has one
  place to change.
- **A server field error appears on its field**, where a client error on
  that field would: the same place, the same look. The user can't tell
  which side found it.
- **It clears when the user changes that field.** The server judged the
  value that was sent; a changed value hasn't been judged. The field's own
  checks run as usual, and the next submit asks the server again. Errors
  on other fields stay until those fields change.
- **After a failed submit, the focus moves to the first invalid field**, in
  the form's order, whether the client or the server rejected it.
- **A field error is matched by name and code.** A shared helper splits an
  `ApiError`'s field errors into those the form has a field and wording
  for, and the rest. A form whose fields are named differently from the
  API's maps the names explicitly.
- **Everything that isn't about a field is a notification**, not part of
  the form: a field error the form can't place (an unknown field or code),
  a `bind_error`, other HTTP failures and network failures. Notifications
  are decided with the feedback UI; until then, each form keeps its
  current submit-error line as a placeholder. An error the form can't
  place also goes to the console with its request ID: it means the client
  and the API disagree about the contract.

## Alternatives considered

- **Messages from the server.** No wording table in the client, but 0025
  rejected messages in responses, and two sources of wording would read
  differently.
- **Server errors stay until the next submit.** Simpler state, but the
  message keeps describing a value that's no longer there, and the field
  looks wrong while the user fixes it.
- **Unplaceable field errors shown as a generic line in the form.** Nothing
  is lost, but the line says nothing the user can act on, and it sits in
  the form as if it were about a field.
- **No client-side checks; the server validates.** One source of rules,
  but a round trip for every mistake and no feedback while typing.

## Consequences

- Each module with forms has a wording function for its fields' codes, and
  its validators return codes rather than text.
- The API's field codes become part of what a form depends on: a new code
  the form doesn't know is treated as unplaceable until the form's wording
  handles it.
- A limit stated in a message ("at most 200 characters") is the client's
  copy of the server's limit. If the two drift, the server's verdict still
  lands on the right field, with the client's number.
- Until notifications exist, a form shows its placeholder line for
  failures that aren't about a field.

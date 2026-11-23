# 0041. Feedback: toasts, page states and navigation progress

- Status: Accepted
- Date: 2026-11-23
- Tags: front-end, ux, accessibility

## Context

The client app reports problems in several ad-hoc ways. A failed save shows a
line next to the form's buttons, a placeholder [0038](0038-form-validation-errors.md)
set until notifications exist. A failed delete shows a line inside the
confirmation dialog, which disappears with its row when the list refetches.
A route that fails to load shows a message and "Try again" without a
heading, and an unknown URL shows the router's bare "Not Found" (#48). A
navigation waits for its loader before switching pages
([0030](0030-server-state-owned-by-tanstack-query.md)), and the generic
pending page appears only after a second, so a click on a slow network seems
ignored until then.

Most code is written by coding agents, so each kind of feedback needs one
place and one rule.

## Decision

- **A toast reports the outcome of an action when the outcome isn't about a
  field**: a failed save that no field can show, a failed delete, a network
  failure, a 404 or a 500. Field errors stay on their fields (0038).
- **Error toasts stay until dismissed.** An error the user must read has no
  time limit. Toasts pause while hovered or focused, can be dismissed by
  keyboard, and are announced to assistive technology, errors assertively.
  The same message shown again while its toast is open doesn't stack a
  second one.
- **No success toasts while the result is visible.** Creating or saving a
  card opens its page, and deleting removes it from view; the overview marks
  recent cards ([0040](0040-row-timestamps-in-the-api.md)). An action whose
  result can't be seen gets a success toast, or better, a visible result.
- **Each call site reports its own failure**, with its module's wording,
  through one shared function. The API layer has no wording
  ([0031](0031-generated-api-types-and-typed-fetch-client.md)) and reports
  nothing itself.
- **A decision is never a toast.** A state the user must resolve (choose
  between two versions, confirm leaving with unsaved edits) is an alert that
  stays in the page until resolved. None exists yet; the first one decides
  its component.
- **A navigation shows progress**: a thin bar at the top of the page while a
  navigation loads, after a short delay so fast navigations don't flicker,
  and without animation for users who prefer reduced motion.
- **Pages for failure have headings**: a route that fails to load shows
  "This page couldn't load", its reason and "Try again"; an unknown URL
  shows "Page not found" with a link to the library. Both have one `<h1>`.
- **Background refetches that fail stay silent**, as 0030 decides: the page
  keeps the data it shows.
- **No loading skeletons** for now. The progress bar covers the wait; a page
  that is visibly slow in a deployed environment gets its own skeleton then.

This amends 0038: its placeholder line becomes a toast.

## Alternatives considered

- **Inline error messages everywhere.** No new component, but a message in a
  dialog or a row disappears with it, and every action needs its own place
  for one.
- **Toasts that time out.** Less clutter, but an error can vanish before it's
  read, which fails users who read slowly or look away.
- **Success toasts for every action.** Reassuring, but they repeat what the
  screen already shows, and a stream of them trains users to ignore toasts.
- **A global handler that toasts every failed mutation.** One place, but the
  API layer would need wording, or every message would be generic.
- **Skeletons for every page.** Polished, but each page's skeleton must
  follow its layout, for waits that are milliseconds locally.

## Consequences

- One toast component and one function to report a failure, used by every
  module.
- A confirmation dialog closes when its request settles, success or failure,
  and a failure becomes a toast that outlives the dialog and its row.
- Every page, including failure pages, has one `<h1>`.
- Waits are visible from the first fraction of a second on every navigation.

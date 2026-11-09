# 0030. Server state owned by TanStack Query, organized by backend service

- Status: Proposed
- Date: 2026-11-09
- Tags: front-end, architecture, api

## Context

Most of the client app's state is a copy of data the server owns: cards
today, and later decks, plans, sessions and progress from several services.
A copy can go stale, two copies can disagree, and every screen that fetches
for itself repeats the same loading and error handling. The client app is
sliced into modules by user activity (library, practice, planning,
dashboard, progress), but those slices don't match the backend services:
several modules read the same cards, and one screen can read from several
services.

## Decision

- **The TanStack Query cache is the only holder of server data.** Components
  don't call `fetch` and don't copy server data into component state or a
  store. The exception is a form draft: it starts from server data and is
  local state until submitted, keeping the `version` it started from
  ([0010](0010-optimistic-concurrency-with-etag-and-if-match.md)).
- **The cache is organized by backend service, not by module.** Each service
  has a folder in `src/api/<service>/` that owns its query keys, query
  options and mutations. Keys start with the service name
  (`['library', 'cards', id]`), so one resource has one cache entry no matter
  which module reads it.
- **Invalidation sits next to the mutation**, in the service's folder. A
  mutation may invalidate another service's data by importing that service's
  key factory, and nothing else from it.
- **Modules own usage**: which data a screen needs, when to prefetch, and
  what a mutation does in the UI (navigation, conflict dialogs, wording).
- **Routes load, components read.** A route's loader prefetches the data the
  page needs with `ensureQueryData`, in parallel when it needs several
  queries. Components read it with `useSuspenseQuery`, so the data is always
  defined. Each route's `pendingComponent` and `errorComponent` handle the
  other states. A part of a page that must fail on its own gets its own error
  boundary.
- **Data that changes inside a page goes in the URL.** Filters, pages and
  selections are search params, so a change is a navigation that the loader
  handles, not a component suspending in place.
- **One `QueryClient`**, created in the app shell and passed to the router's
  context. Client errors (4xx) are not retried.

## Alternatives considered

- **A client store (Redux, Zustand) holding server data.** It duplicates the
  cache and needs manual syncing and invalidation.
- **Keys owned by each module.** The same card would be cached twice under
  different keys, and a mutation would have to know every module's keys.
- **`useQuery` in components without loaders.** Fetches start only when a
  component renders, nested components fetch one after another, and every
  component handles loading and error itself.
- **One query client per module.** A component sees only the nearest client,
  so cross-module invalidation means reaching into other modules.

## Consequences

- Page components contain no loading or error branches, and the data they
  read is non-optional in the types.
- Fetches start when navigation starts, or on hover with intent preloading.
- Stale data refetches in the background without suspending. A failed
  background refetch keeps the old data instead of replacing the page with an
  error.
- Mutations still handle their own pending and error states; suspense
  covers reads only.
- When a mutation in one service changes data another service derives
  asynchronously (through events), an immediate invalidation can fetch the
  old value. Each such case needs an explicit answer: the response carries
  the new values, an optimistic update, or a server-sent change event.
- The current `src/api/learning-cards.ts` and the routes that fetch in their
  components move to this layout.
- The module and service boundaries are enforced only by review until a
  boundary lint rule is added.

# 0032. Stateful fake backend with MSW

- Status: Accepted
- Date: 2026-11-11
- Tags: front-end, testing, api

## Context

Testing or running the client app against the real backend needs the whole
stack: the server, PostgreSQL, migrations and test data. That is slow for
component tests, makes error and edge cases hard to produce, and blocks UI
work on an endpoint until the server side exists. Static fixtures don't
help with flows: after the first mutation, the next read returns stale
data. The parts of the contract that are hardest to get right in the UI are
behavior, not shapes: versions and 412 on a stale `If-Match`
([0010](0010-optimistic-concurrency-with-etag-and-if-match.md)), opaque
pagination cursors ([0022](0022-opaque-pagination-cursor-contract.md)) and
error codes ([0025](0025-error-responses.md)).

## Decision

- **A fake backend answers the client app's requests through MSW**, which
  intercepts `fetch` in the browser and in Node. The client app's code is
  the same whether the fake or a real server answers.
- **Each service has a fake in `src/api/<service>/fake/`**:
  - a hand-written, in-memory **store** that holds the state and its rules:
    IDs, versions, 412 on a stale version, not found, ordering and cursors;
  - **handlers** that map requests to the store and the store's outcomes
    to responses, typed with `openapi-msw` against the generated types
    ([0031](0031-generated-api-types-and-typed-fetch-client.md)), so a
    path, parameter or response that no longer matches the spec fails the
    type check;
  - **factories** that build valid data for seeds and tests.
- **The fake implements what the client app's flows depend on, and
  nothing else:** state across requests, versions with 428 without
  `If-Match` and 404 before 412 on a stale version, a 400 for a malformed
  ID, opaque cursors in newest-first order, and minimal input validation
  (trimmed, required, maximum length, page size). It doesn't reproduce the backend's input parsing,
  canonicalization or order of checks; the backend's own tests cover
  those. Any other response a test needs, such as a specific error, comes
  from a per-test handler override, not from the fake.
- **`src/api/fake.ts` assembles all services' handlers** with the same base
  URLs as the real clients. Fakes may call each other's stores to simulate
  backend events, optionally with a delay.
- **One fake for every use:** `npm run dev:mock`, which runs the client app
  in the browser with seeded scenarios and no backend, and the client app's
  tests and component previews once those tools are chosen. Tests reset the
  stores between tests and override handlers per test for errors, latency
  and empty states.
- **The fake is never in a production build.** MSW's Vite plugin serves the
  worker only to the mock mode, and the fake is loaded only behind the mock
  mode's check, so a production build contains neither.
- **Spec first, then the fake.** A new or changed endpoint is added to the
  spec, then to the fake, so UI work can start before the server side is
  done.

## Alternatives considered

- **Static JSON fixtures.** No state, so a flow breaks after its first
  mutation.
- **`@mswjs/data` as the store.** Saves storage code, but the contract's
  behavior (versions, `If-Match`, cursors, error codes) would still be
  written by hand in every handler, on top of an extra dependency.
- **Mocks generated from the spec** (Orval, Pactwork). Random data with the
  right shapes but none of the contract's behavior.
- **Tests against the real backend only.** Slow, needs the whole stack, and
  makes rare errors hard to produce.

## Consequences

- The whole client app can be run and tested without the backend, with
  seeded scenarios such as an empty library, many cards or failing requests.
- Every API change has one more place to update: spec, server, server tests,
  generated types and the fake. Shape mismatches fail the type check;
  behavior mismatches don't.
- The fake can drift from the real backend's behavior. Comparing the fake
  with the real backend on the same requests, and a small set of end-to-end
  tests, cover that; the testing strategy is a separate record.
- The fake stores are a second, simplified implementation of each service.
  They stay in-memory and implement only what the client app's flows
  depend on.

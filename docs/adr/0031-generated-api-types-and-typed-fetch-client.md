# 0031. Generated API types and a typed fetch client

- Status: Accepted
- Date: 2026-11-11
- Tags: front-end, api, tooling

## Context

The OpenAPI spec is the source of truth for the API
([0004](0004-spec-first-open-api-contract.md)), but the client app's request
and response types are hand-written copies of it, and each request function
builds URLs, headers and error handling by hand. The copies drift silently,
and error messages are built from `statusText`, which is empty over HTTP/2.
The backend will be split into several services, each with its own spec and
possibly its own origin.

Generators range from types only, through SDK functions per operation, to
complete TanStack Query hooks, validators and mocks. The client app type-checks
with TypeScript 7, which has no JavaScript API; generators that build their
output with TypeScript's API need TypeScript 5.

## Decision

- **Types are generated, the rest is written by hand.** `openapi-typescript`
  generates types from each service's bundled spec. Query keys, query
  options, mutations and invalidation are hand-written against those types
  ([0030](0030-server-state-owned-by-tanstack-query.md)). While the backend
  serves one spec, there is one generated file, `src/api/schema.gen.ts`.
- **The generator runs from `frontend/tools/`**, a package with its own
  pinned `openapi-typescript` and TypeScript 5, so the client app keeps
  TypeScript 7.
- **Generated files are committed.** `make check` regenerates them and fails
  when they differ from the committed ones, and it type-checks the client
  app. CI installs Node from the version in `frontend/package.json`, the
  single source the devcontainer's copy is checked against
  ([0028](0028-ci-reuses-the-devcontainer-test-database.md)).
- **`openapi-fetch` is the only HTTP client.** Paths, parameters, bodies and
  responses are checked against the generated types. A shared factory in
  `src/api/http.ts` creates one client per service, and every query passes
  its abort signal to its request.
- **Failures become one typed `ApiError`**: a network failure, or an HTTP
  error carrying the status, the error `code`, the field errors and the
  `X-Request-Id`. An aborted request stays an abort. Only network failures
  and server errors (5xx) are retried, which narrows 0030's rule.
- **The client owns all wording** ([0025](0025-error-responses.md)).
  User-facing messages are chosen from the error and the operation, never
  from `statusText` or the response body. The API layer contains no
  user-facing text.
- **Base URLs come from one config module.** Today every service is on the
  same origin. How the config is delivered at runtime is decided when a
  second origin or a gateway exists.

## Alternatives considered

- **Hand-written types** (the previous state). They drift from the spec, and
  nothing reports it.
- **Orval**: generates TanStack Query hooks, validators and mocks. It
  generates the parts that hold our decisions (keys, invalidation), its output
  is much larger than the types, and a code generator's conventions would
  shape every request, as 0004 avoids on the server.
- **`@hey-api/openapi-ts`**: generates SDK functions per operation. More
  generated code to read for little gain over a typed `fetch` wrapper.
- **Running the generator with the client app's TypeScript.** It fails to
  install and crashes under TypeScript 7. Moving the whole client app to
  TypeScript 5, or to a two-compiler setup, would change its toolchain for one
  generator.
- **Runtime validation of responses** (for example with Zod). The backend's
  API tests already check every response against the spec.

## Consequences

- A spec change shows up in the pull request as a change to the generated
  types, next to the spec change, and breaks the type check wherever it
  matters.
- `make check` and CI now need Node and the client app's dependencies, and
  `frontend/tools/` is one more lockfile to keep up to date.
- One place handles request IDs, error mapping and, later, authentication
  and client error reporting.
- Types only describe shapes. Behavior such as 412 on a stale `If-Match` is
  still the client app's code and tests.
- Adding a service means adding a spec input, a folder and a client, without
  changing modules.

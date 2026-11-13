# 0033. Oxlint and oxfmt for the client app

- Status: Proposed
- Date: 2026-11-13
- Tags: front-end, tooling

## Context

The client app has no linter and no formatter. Rules from earlier records,
such as components not calling `useQuery` or `fetch`
([0030](0030-server-state-owned-by-tanstack-query.md)) or code outside
`src/api/` importing a service only through its index, are checked only in
review, and review has already missed an unhandled promise rejection
(#9). Most of the code is written by coding agents, so every rule that
isn't a check costs review time.

The client app type-checks with TypeScript 7, which has no JavaScript API.
typescript-eslint, which type-aware ESLint rules depend on, supports only
TypeScript below 6.1. Oxlint's type-aware rules run on typescript-go, the
compiler TypeScript 7 is built on. Biome infers types itself, without the
compiler, and its promise rules are still experimental.

## Decision

- **Oxlint lints the client app**, with type-aware rules. Its configuration
  is `frontend/.oxlintrc.json`:
  - the correctness and suspicious categories, with the TypeScript, React,
    jsx-a11y, import, unicorn and oxc plugins, including the React hooks
    rules and the promise rules (`no-floating-promises`,
    `no-misused-promises`); no style category, since the formatter owns
    style;
  - every rule turned off, globally or for some files, has its reason next
    to it in the configuration;
  - an inline disable names the rule and gives a reason.
- **Module boundaries are lint rules**, with `no-restricted-imports` per
  directory:
  - outside `src/api/`, code imports a service only through
    `@/api/<service>`, plus the shared files directly in `src/api/`;
  - only `src/mock/` and tests import the fakes
    ([0032](0032-stateful-fake-backend-with-msw.md));
  - outside `src/api/`, `useQuery`, `useQueryClient` and `openapi-fetch`
    aren't imported; pages read data with `useSuspenseQuery` and the API
    layer's query options, and change it with the API layer's mutation
    hooks (0030).
- **oxfmt formats the client app with its defaults.** Import sorting and
  Tailwind class sorting are separate decisions.
- **Generated files are neither linted nor formatted**
  (`src/api/schema.gen.ts`, `src/routeTree.gen.ts`). Vendored shadcn
  components in `src/components/ui/` are treated like the rest of the code.
- **Both are part of `make check`** (`frontend-lint`, `frontend-fmt-check`),
  and lint warnings fail it, as golangci-lint's do. Oxlint, its type-aware
  backend and oxfmt are pinned to exact versions, so an upgrade, which can
  add rules or change formatting, is a deliberate change.
- **The reformat is one formatting-only commit on `main`**, listed in
  `.git-blame-ignore-revs`.

## Alternatives considered

- **ESLint with typescript-eslint.** The largest set of rules and plugins,
  but type-aware rules would need a second, older TypeScript installed just
  for linting, checking the code with a different compiler than the build.
- **Biome for linting and formatting.** One tool with a mature formatter,
  but its type inference is its own approximation of TypeScript, and the
  promise rules this project most needs are experimental.
- **Prettier.** The established formatter. oxfmt passes Prettier's
  JavaScript and TypeScript conformance tests and comes from the same
  toolchain as Oxlint and Vite; its output matches Prettier's, so a switch
  back produces no diff.
- **Matching the current style** (single quotes, no semicolons). A smaller
  first diff, but a configuration to keep instead of the defaults.

## Consequences

- Rules from 0030 and 0032 become lint errors instead of review comments.
- Type-aware rules see the same types as `tsc`.
- Oxlint's plugins for ESLint compatibility are still in alpha, so rules
  that exist only as ESLint plugins (such as TanStack Query's) aren't used.
- oxfmt is not yet at 1.0; if it causes trouble, Prettier replaces it
  without reformatting.
- The adoption reformats every file of the client app once.

# 0037. Client lint config written in TypeScript

- Status: Accepted
- Date: 2026-11-16
- Tags: front-end, tooling

## Context

The module boundaries of [0033](0033-oxlint-and-oxfmt-for-the-client-app.md),
[0035](0035-client-app-modules-by-user-activity.md) and
[0036](0036-pages-read-route-data-components-take-props.md) are
`no-restricted-imports` rules, set per directory in overrides of
`frontend/.oxlintrc.json`. An override replaces a rule's options instead
of merging them, so every override repeats every restriction that still
applies to its files. Each new boundary repeats the shared ones again:
the file has grown to 566 lines, the Phosphor restriction appears nine
times and the API-index one six, and the `components/` override added 71
lines, 52 of them copies. A change to one restriction has to be made in every copy,
and nothing checks that the copies agree. The next boundaries
(route-data hooks in components, nested component folders, widgets) would
each add another copy.

Oxlint reads a TypeScript config file, `oxlint.config.ts`, as well as
JSON. Node runs it directly, by stripping the types.

## Decision

- **The client app's lint config is `frontend/oxlint.config.ts`**, and
  replaces `frontend/.oxlintrc.json`. It sets the same options,
  categories, plugins and rules as before; the decisions of 0033 are
  unchanged.
- **Each restriction is written once**, as a named constant with its
  message and the ADR that decided it. An override lists the restrictions
  that apply to its files by name, so reading an override shows exactly
  which boundaries hold there. Plain arrays and spreads, no generation
  logic: the file reads as a list of rules, not a program.
- **The reasons stay next to the rules**, as comments, as 0033 requires
  for every rule turned off.
- **The config is type-checked** with `defineConfig`, by
  `make frontend-typecheck`, and written in syntax Node can strip
  (`erasableSyntaxOnly`).

This amends 0033: its configuration is `frontend/oxlint.config.ts`.

## Alternatives considered

- **Keep the JSON and accept the copies.** No new mechanism, but every
  boundary multiplies the copies, and a restriction changed in one place
  and missed in another fails silently.
- **Generate the JSON from a script, with a staleness check in
  `make check`.** The same single source, but a second file to keep in
  sync, a generation step to remember, and the editor reads the output,
  not the source.
- **Nested config files per directory.** Oxlint's nested configs and
  `extends` still replace a rule's options instead of merging them, so
  they don't remove the copies.
- **A dedicated boundary tool such as dependency-cruiser.** Expressive
  rules for module graphs, but a second tool and config next to the
  linter, and its TypeScript support relies on the compiler API that
  TypeScript 7 doesn't have.

## Consequences

- A new boundary is one constant and one name per override that needs it.
- The config is code: it can be wrong in ways JSON can't, which type
  checking and the lint run in `make check` catch, and it must stay
  simple enough to read as a list.
- The editor reads the TypeScript config through the same Oxlint package
  as `make frontend-lint`; `oxc.configPath` in the devcontainer points to
  it.
- The JSON schema reference goes; `defineConfig` gives the same
  completion and checks.

# 0042. Component structure: logic, state and view

- Status: Accepted, Amended by [0044](0044-named-values-in-components.md) (named values that only shape rendering may stay in the component)
- Date: 2026-11-23
- Tags: front-end, architecture, testing

## Context

[0036](0036-pages-read-route-data-components-take-props.md) decides where data
comes from: pages read it, components take it as props. It doesn't decide how
a component with behavior is built inside. The card form shows the result: a
component of about 300 lines whose body holds a 50-line save workflow
(create or update, canonicalizing, error placement, logging, focus), whose
fields are render-prop lambdas nested in each other, and whose rules can't be
tested without rendering it with a router and a query client. Some wording
that is plain logic (`card-error-message.ts`, `card-field-message.ts`) sits
among the components.

The goal is code whose logic can be tested on its own, and markup that can be
tested with given state, without a backend. Most code is written by coding
agents, so the structure must be one rule with names that say what a file is.

## Decision

- **Rules and decisions are plain functions in the module's `model/`.**
  Validation, canonicalizing, wording, classification (such as
  `recentChange`) and the types they share. `model/` imports no React, no
  TanStack, no UI and no components; from the API layer it imports types
  only. Lint enforces it ([0033](0033-oxlint-and-oxfmt-for-the-client-app.md)).
- **A component with behavior is three files**, side by side in
  `components/`, named by suffix like a page's `.load.ts`:
  - `<name>.state.ts`: the hook `use<Name>`, which holds the component's
    state, its data and mutation hooks, its workflows (a submit, a delete)
    and the values its markup needs, and returns them as the view's props.
  - `<name>.view.tsx`: a component that renders its props. It holds no data
    or mutation hooks and makes no decisions; hooks that only serve
    rendering (refs, the virtualizer, layout measurement) are allowed. It
    imports nothing from the API layer.
  - `<name>.tsx`: the component other code uses, joining the two:
    `<NameView {...useName(props)} />`.
  A component without behavior stays one file.
- **The markup reads named values.** JSX may test a named value
  (`{saveError && …}`), choose between two elements or strings on one named
  value, map a list to one component per item, and call one function in a
  one-line handler. Comparisons, arithmetic, string building, nested
  ternaries, and handlers of more than one statement go into the state hook
  or `model/`. Lint forbids nested ternaries; review enforces the rest.
- **A render-prop callback renders one component.** Anything more is a
  component of its own. Form fields are components bound to the form with
  TanStack Form's composition API (`createFormHook`), not nested
  `form.Field` callbacks.
- **Shared code moves up only when it's shared.** A hook used by one
  component lives in its `.state.ts`; one used by several of a module's
  components is its own file in `components/` (`use-<name>.ts`); one useful
  to every module goes to `src/shared/lib/`. No folders by kind
  (`hooks/`, `utils/`) inside or across modules.

This amends 0035 (a module's `model/` has a lint boundary, and wording that
is plain logic lives there) and 0036 (how a component with behavior is
split).

## Alternatives considered

- **Everything in the component.** One file to read, but the logic can only
  be tested by rendering, and long components mix workflow and markup.
- **No ternaries or inline functions in JSX at all.** A strict rule, but
  moving `saving ? "Saving..." : "Save"` three lines up gains nothing:
  testability comes from leaving the component, not the `return`.
- **Folders by kind** (`hooks/`, `models/`, `views/`). Familiar from other
  projects, but one feature's change touches several distant folders, the
  opposite of [0035](0035-client-app-modules-by-user-activity.md).
- **A folder per component.** Groups the three files, but `components/` is
  flat by 0036, and suffixes keep them together in the listing anyway.
- **A hook for every component.** Uniform, but ceremony where there's
  nothing to hold.

## Consequences

- Logic in `model/` is tested by calling functions; a state hook is tested
  without its markup; a view is tested with given props
  ([0043](0043-unit-and-component-tests-with-vitest.md)).
- A component with behavior is three files instead of one.
- The library module's components move to this shape, and its wording files
  move to `model/`.

# 0044. Named values in components

- Status: Accepted
- Date: 2026-11-24
- Tags: front-end, architecture

## Context

[0042](0042-component-structure-logic-state-and-view.md) says that
comparisons, arithmetic and string building in markup "go into the state
hook or `model/`". Its own Alternatives say the opposite for the simplest
case: moving `saving ? "Saving..." : "Save"` a few lines up "gains nothing",
because testability comes from leaving the component, not the `return`. The
prompt that implemented 0042 also allowed a named value above the `return`.

Taken literally, the Decision would move checks such as
`strip !== undefined`, or a progress bar's width, into `model/` or a state
hook. That adds files and makes nothing more testable: such a value can only
be checked by looking at what the component renders, which is what a view
test does anyway. Taken loosely, nothing stops rules of the application from
sitting in components again. The line between the two needs to be stated.

## Decision

- **A value that only shapes a component's rendering may be computed in the
  component**, as a named value above the `return`: whether a slot was given,
  which class or element to use, which of two labels to show, a number
  formatted for display or for a style. This holds in views and in
  components without behavior.
- **A value that a rule of the application decides goes to `model/`**, or to
  the state hook when it needs React: limits, validation, classification
  (what counts as recent), wording, what a failure means. So does any value
  that uses data, mutations, navigation or the clock, and any value more than
  one component needs.
- **The test for which side a value is on**: would a test of it check a rule
  of the application, or only what the markup looks like? A rule goes to
  `model/` or the state hook; a matter of markup may stay.
- **The markup still reads named values**, as 0042 decides: no comparisons,
  arithmetic or string building inside JSX itself.

This amends 0042: named values that only shape rendering may stay in the
component.

## Alternatives considered

- **Everything computed goes to `model/` or the state hook, as 0042 reads.**
  One rule without judgment, but files for `x !== undefined` that no test
  would ever call.
- **No rule beyond "named values in the markup".** Simple, but nothing keeps
  rules of the application out of components.

## Consequences

- Views and simple components may hold small derivations of their props.
- Review asks one question of a computed value: rule or markup.
- 0042's examples stay valid: `saving ? "Saving..." : "Save"` may be a named
  value in the state hook or the view; what a failed save means stays in
  `model/`.

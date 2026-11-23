# 0043. Unit and component tests with Vitest

- Status: Accepted
- Date: 2026-11-23
- Tags: front-end, testing

## Context

The client app is tested only through the browser, with Playwright
([0034](0034-browser-tests-with-playwright.md)): flows in mock mode against
the fake backend, and success paths against the real one. Every check, down
to a field's message for one code, needs a page, a route and a navigation.
[0042](0042-component-structure-logic-state-and-view.md) splits components
into logic in `model/`, state hooks and views, so each can be tested on its
own, faster and for more cases.

## Decision

- **Vitest** runs the client app's unit and component tests, configured
  from the app's Vite config, so imports, aliases and plugins behave as in
  the app.
- **Two kinds of test, by file name, next to what they test:**
  - `*.test.ts`: plain functions, mainly `model/`, in Node, without a DOM.
  - `*.test.tsx`: state hooks and views, in **browser mode**, in Chromium
    through Playwright, which the project already installs. Hooks are
    rendered with `renderHook`, views with `render`, both from
    `vitest-browser-react`, and queried by role, label and text, as the
    Playwright tests do.
- **What each layer covers:**

  | Layer | Covers | Doesn't cover |
  |---|---|---|
  | `model/` tests | every rule and its edge cases | rendering |
  | state hook tests | workflows: what a submit or delete does on success and failure, the values the view gets | markup |
  | view tests | each state the view can show, from given props: labels, disabled controls, errors, empty states | data, navigation |
  | Playwright mock | flows across pages: navigation, history, scroll restoration, virtualization, layout | single rules and states |
  | Playwright e2e | success paths against the real backend | edge cases |

  A check belongs to the lowest layer that can make it.
- **The network is the default seam.** State hooks run with a real
  TanStack Query client against the fake backend's handlers
  ([0032](0032-stateful-fake-backend-with-msw.md)), started in the test
  page with MSW; a test changes what the fake answers, not the hook's
  imports. `vi.mock` is for what isn't the network, and the clock uses
  Vitest's fake timers.
- **Each test is isolated:** a new query client and a reset fake per test.
- **`make check` runs them**, as `make frontend-unit`, and CI with it.

## Alternatives considered

- **Playwright only.** One tool, but every case costs a page load and a
  navigation, so edge cases go untested.
- **jsdom or happy-dom instead of browser mode.** Faster to start, but a
  simulated DOM has no layout, so focus, measurement and the virtualizer
  behave differently than for users.
- **Playwright component testing.** Real browser too, but experimental,
  with a separate bundling setup, and it doesn't test plain functions or
  hooks.
- **Mocking the API layer's modules by default.** Quick, but the tests
  then check the hook against an idea of the API layer rather than the API
  layer itself.

## Consequences

- Tests live next to their files; Playwright's stay in `frontend/tests/`.
- Browser-mode tests need Chromium wherever `make check` runs, as the
  Playwright tests already do.
- Existing Playwright mock tests that check single rules or states can move
  down to Vitest over time; none has to move at once.

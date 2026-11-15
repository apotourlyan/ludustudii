# 0034. Browser tests with Playwright

- Status: Proposed
- Date: 2026-11-15
- Tags: front-end, testing, tooling

## Context

The client app has no automated tests. Every pull request so far was checked
by hand or with throwaway browser scripts: the same flows (list, create,
edit, delete, conflicts, not found, failures) were driven again each time,
outside the repository. The fake backend
([0032](0032-stateful-fake-backend-with-msw.md)) lets the client app run
without the Go server and database, with scenarios for empty, large and
failing states. Nothing yet checks that the built Go binary, with the client
app embedded, works end to end in a browser.

`make check` already needs the test database for the backend's integration
tests ([0028](0028-ci-reuses-the-devcontainer-test-database.md)). Playwright's
Chromium downloads in seconds in the devcontainer, and the devcontainer's
image already has the system libraries it needs.

## Decision

- **Playwright drives the browser tests**, with Chromium only. Tests live in
  `frontend/tests/`, in two Playwright projects, and are type-checked,
  linted and formatted like the client app.
- **App tests (`frontend/tests/mock/`) run the client app against the fake
  backend** (`vite --mode mock`), with no Go server or database. They cover
  the client app's flows, error paths included: scenarios and requests made
  from inside the page produce the states they need. Each test gets a new
  page, and with it a fresh fake, so the tests run in parallel. They are
  part of `make check`.
- **End-to-end tests (`frontend/tests/e2e/`) run the built Go binary with
  the client app embedded**, against a database created and migrated on the
  test database server for the run and dropped afterwards. They cover
  success paths. Each test creates its own uniquely named data and asserts
  only on it, never on totals, so these tests run in parallel too. They run
  in their own CI job on every pull request and push to `main`, beside
  `make check`, and locally with `make test-e2e`.
- **Tests find elements the way users do**: by role, label and text. Test
  IDs are a last resort, each with a reason.
- **The browser is installed by Playwright itself**, as the headless shell,
  in the version the pinned `@playwright/test` expects. The devcontainer
  installs it in `post-create.sh` into a named volume, so a rebuild
  downloads nothing; CI installs it with its system libraries and caches it
  by version. `package.json` is the only place the version is pinned.
- **Unit and component tests are a separate decision.**

## Alternatives considered

- **Playwright's browsers in a devcontainer image layer** (a Dockerfile, or a
  community devcontainer feature). Cached by Docker, but the Playwright
  version would be pinned a second time, and the devcontainer would need its
  own image.
- **Playwright's Docker image as a compose service**, with the tests
  connecting to its browser server. No installation in the development
  image, but the browser reaches the app by service name instead of
  `localhost`, and the image tag must match `@playwright/test` exactly.
- **The distribution's Chromium.** No download from Playwright, but not the
  build Playwright is tested against.
- **End-to-end tests in `make check`.** One gate, but every local check would
  build the binary and start the server. A separate CI job blocks the merge
  without adding to `make check`'s time.
- **End-to-end tests run daily.** Cheaper, but a broken embedded build or
  contract would be found after its pull request is merged.

## Consequences

- The flows checked by hand in every pull request become tests in the
  repository, and new features add theirs.
- The app tests depend on the fake behaving like the backend; the
  end-to-end tests check the parts the fake can't: the embedded build, the
  real API and the database.
- Tests that find elements by role and label fail when the UI loses an
  accessible name, which is intended.
- `make check` needs the Playwright browser; `make frontend-deps` and the
  devcontainer install it.
- A Playwright upgrade downloads a new browser once, in the devcontainer and
  in CI.

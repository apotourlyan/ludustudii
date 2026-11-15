# 0035. Client app modules by user activity

- Status: Proposed
- Date: 2026-11-15
- Tags: front-end, architecture

## Context

The client app has one feature, learning cards, spread across
`src/components/` (the card components next to app-wide pieces such as the
route error page and the error wording), `src/components/ui/` (shadcn),
`src/lib/` and `src/routes/`. Everything imports everything. The product
will grow into several areas a user moves between: managing content
(areas, courses, decks, cards), practicing, planning, a dashboard and
progress. Those areas don't match the backend's services one to one: one
screen can read from several services, and several screens read the same
service. The API layer is already organized by backend service
([0030](0030-server-state-owned-by-tanstack-query.md)). Most code is
written by coding agents, which need one obvious place for each new file.

## Decision

- **The client app is sliced into modules by user activity**, in
  `src/modules/<module>/`. Today there is one, `library` (content
  management: cards now, then decks, courses and areas). `practice`,
  `planning`, `dashboard` and `progress` follow as they are built.
- **The top level:**
  - `src/main.tsx`: bootstrap only;
  - `src/app/`: the shell: router and query client setup, the root layout
    and navigation, the pending and error pages. The only code that may
    combine several modules;
  - `src/routes/`: TanStack Router's file routes, thin: path, params,
    loader and the page from a module;
  - `src/modules/`: the modules;
  - `src/shared/`: what every module uses and that knows no module:
    `ui/` (the shadcn components), `lib/` (helpers), and generic wording
    for API failures;
  - `src/api/`, `src/mock/` and `src/styles/`, unchanged.
- **A module's shape is fixed:** `index.ts` (its public surface: pages,
  later dashboard widgets), `pages/` (one component per route) and
  `components/` (private to the module). A `model/` folder for plain
  TypeScript logic is added when a module needs one.
- **URLs start with the module**, such as `/library/cards` and
  `/library/cards/$cardId`. Route files are grouped the same way, in
  `src/routes/library/`. `/` leads to the library until the dashboard
  exists.
- **Boundaries, enforced by lint as in
  [0033](0033-oxlint-and-oxfmt-for-the-client-app.md):**
  - modules don't import each other; they connect through URLs, and
    anything that combines modules lives in `src/app/`;
  - from outside a module, only its `index.ts` is imported; inside, imports
    are relative;
  - `src/shared/` imports nothing from `src/app/`, `src/routes/` or
    `src/modules/`, and from the API layer only `@/api/http`.
- **Modules own their wording** (0030): `src/shared/` words the generic API
  failures (network, server errors); each module words what is specific to
  its resources, such as a missing or changed card.

## Alternatives considered

- **Folders by technical kind** (`components/`, `hooks/`, `pages/` for the
  whole app). Simple while small, but every feature spreads across all of
  them, and nothing shows which code belongs together or may change
  together.
- **Modules mirroring the backend services.** One API per module, but
  screens span services, so pages would import from several modules. The
  API layer already follows the services; the modules follow the user.
- **Routes defined inside each module** (code-based or virtual file
  routes). Keeps everything about a module in one folder, but gives up the
  file-route conventions and the generator the client app uses.
- **Unprefixed URLs.** Shorter, but the URL no longer says which part of
  the app a page belongs to, and changing it later breaks links.

## Consequences

- Every new file has one place: a page in a module's `pages/`, its parts in
  the module's `components/`, its route in `src/routes/<module>/`.
- A module can be read, changed and tested mostly on its own, and lint
  stops one module from reaching into another.
- A dashboard that shows parts of several modules is composed in
  `src/app/`, from what each module exports.
- The shadcn CLI's paths change with the move (`components.json`).
- Moving to module-prefixed URLs changes every URL once.

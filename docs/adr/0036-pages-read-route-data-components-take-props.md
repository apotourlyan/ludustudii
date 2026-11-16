# 0036. Pages read route data, components take props, widgets own theirs

- Status: Accepted
- Date: 2026-11-16
- Tags: front-end, architecture

## Context

[0030](0030-server-state-owned-by-tanstack-query.md) has route loaders fill
the query cache and components read it with `useSuspenseQuery`, but doesn't
say which component reads. [0035](0035-client-app-modules-by-user-activity.md)
gives a module `pages/` and `components/`, but doesn't say what each may do.
The library's pages show the result: the edit page reads its card and
passes it down, the list page renders a component that reads the list
itself, and the page layout (the `<main>` landmark, the heading, the page
width) and the navigation after a save sit in whichever component is on
top. A query read deep in the tree is also invisible next to the loader:
if a component reads a query the loader doesn't fill, it suspends while
rendering, which brings back the request waterfall and the pending flash
that loaders exist to prevent.

Some data must not hold up a page: dashboard tiles that load and fail one
by one, a secondary panel, or suggestions that follow what the user types
and don't belong in the URL. Those need a place of their own. Most code is
written by coding agents, so the rule must be checkable, not a judgment
made anew in every file.

## Decision

- **A module's files are of three kinds**, by folder:

  | Folder | Reads queries | Gets its data from | Handles loading and failure |
  |---|---|---|---|
  | `pages/` | with `useSuspenseQuery`, only what its load function fills | the cache, filled before it renders | no: the route's pending and error components do |
  | `components/` | never | props | no |
  | `widgets/` | its own | its own fetch | yes, itself |

  `components/` is flat for now; its lint rule covers only files directly
  in it.

- **A page's load function lives next to it**, in `pages/<page>.load.ts`
  beside `pages/<page>.tsx`. It fills every query the page reads, and
  nothing else, and returns no data, as 0030 requires. The route's loader
  only calls it. A reviewer reads the two neighboring files to see that the
  page reads exactly what its load function fills. Turning a failure into
  the router's `notFound()` happens in the load function too, since what
  counts as missing is the module's knowledge. A load file imports only the
  API layer and the router, never components: TanStack Router keeps every
  loader in the initial bundle and splits only the components, so a load
  file that imported UI would pull its page into the initial bundle.
- **The page owns the screen:** its `<h1>`, its width and placement, and
  what happens after an action succeeds, such as going back to the list.
  The root layout provides the `<main>` landmark around every page.
- **Components take data as props** and own only UI state. They don't
  navigate imperatively: they render links, and report outcomes through
  callbacks (`onSaved`) for the page to act on. They don't set their own
  page width or outer margins; their parent places them. They don't
  render widgets.
- **Mutations stay with the interaction that owns them.** A component may
  call a mutation hook from the API layer, because its pending and error
  states belong to that interaction (a delete button and its dialog).
  What follows a success at page level is the page's, through a callback.
- **A widget is independent:** it owns its query, shows its own loading
  state, and fails on its own, behind its own Suspense and error boundary,
  or with inline states and `useQuery` where suspending would be wrong (a
  dropdown of suggestions). A page renders widgets; `src/app/` composes
  them across modules through each module's `index.ts` (0035). The
  `widgets/` folder is created with the first widget.
- **The question that decides between a page's data and a widget:** must
  the page wait for this data before it shows anything useful? If yes, it
  goes in the page's load function. If no, it's a widget. A page may load
  several queries; that alone doesn't make anything a widget.

This amends 0030 (its loaders now call the page's load function, and pages,
not any component, read what loaders fill) and 0035 (a module gains a
`widgets/` folder and `.load.ts` files next to its pages, exported from
its index).

## Alternatives considered

- **Each component reads the queries it needs.** The cache removes
  duplicate requests and no props are passed down, but nothing ties a read
  to a loader: a missing loader entry shows up only as a pending flash at
  runtime, and every component needs a query client to render in a test.
- **The decision made per page, without a rule.** Flexible, but the four
  existing pages already show four answers, and agents would add a fifth.
- **The load function in the page file.** One file instead of two, but the
  router keeps loaders in the initial bundle, so every page and its
  dependencies would load up front (125.5 → 216.5 kB gzip with three
  pages), and hot reload would remount the page on every edit.
- **Each loader split into its page's chunk.** Keeps one file, but a
  route's fetch would wait for its chunk to download first.
- **Loaders stay in the route files.** Keeps routes as the one place for
  everything the router does, but splits each loader from the reads it
  must match across two folders.
- **Pages pass mutation functions and their state down as props.**
  Components would hold no mutations, at the cost of three props per
  action and a page that knows every dialog's pending state.

## Consequences

- Every query a page reads is visible next to the function that fills it,
  in the neighboring load file.
- The initial bundle doesn't grow with each page: a page stays in its
  route's chunk.
- Components render their data from props alone, so a component test
  needs no fake backend and no loaded route, and a component can be reused
  on another page, such as the card view in a future practice session. A
  component that renders links or calls a mutation still needs a router or
  a query client in its test.
- Data that is slow, optional or driven by typing has a defined home
  that can't hold up or break the rest of the page.
- Props are passed one or two levels down, which is a cost accepted on
  purpose.
- Enforced by lint (0033) where an import or an export says it:
  components import nothing from `@tanstack/react-query`, no imperative
  navigation from the router, and no widgets, and a page file exports
  nothing but its component, which keeps the load function out of it.
  Review enforces the rest: that a page reads only what its load function
  fills, that a load file imports no UI, and that widgets handle their own
  failure.
- The library's pages and components move to this shape, and the
  boundary configuration gains one more override for `components/`.

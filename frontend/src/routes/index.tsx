import { createFileRoute, redirect } from "@tanstack/react-router";

// Home leads to the library until the dashboard exists (ADR 0035). The
// redirect runs before anything renders, and the router records only where
// it ends, so Back doesn't return here. It keeps the query string, such as
// the mock mode's ?scenario=empty.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/library/cards", search: true });
  },
});

import { createFileRoute, redirect } from "@tanstack/react-router";

// Home leads to the library until the dashboard exists (ADR 0035). The
// redirect runs before anything renders, and replaces the history entry, so
// Back doesn't return here only to be sent on again.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/library/cards", replace: true });
  },
});

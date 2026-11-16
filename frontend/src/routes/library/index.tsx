import { createFileRoute, redirect } from "@tanstack/react-router";

// The library has no page of its own yet; its cards are where it starts.
// Like home's, the redirect runs before anything renders and keeps the
// query string.
export const Route = createFileRoute("/library/")({
  beforeLoad: () => {
    throw redirect({ to: "/library/cards", search: true });
  },
});

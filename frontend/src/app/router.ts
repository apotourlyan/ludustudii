import { createRouter } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen";

import { queryClient } from "./query-client";
import { RouteError } from "./route-error";
import { RoutePending } from "./route-pending";

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Run loaders on every navigation and preload; caching is the query
  // cache's job, not the router's.
  defaultPreloadStaleTime: 0,
  // Wait for those loaders instead of rendering the previous data and
  // reloading in the background, so stale data is fetched before rendering.
  defaultStaleReloadMode: "blocking",
  // Back and Forward return to where each page was scrolled; any other
  // navigation starts at the top. A page that renders only part of its
  // content, such as the cards overview, reads the position it is about
  // to get with useElementScrollRestoration and renders that part first.
  scrollRestoration: true,
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

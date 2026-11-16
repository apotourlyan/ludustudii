import type { QueryClient } from "@tanstack/react-query";

import { lcardQueries } from "@/api/lcards";

// Fills what CardsPage reads: the list. Its route's loader calls it. Fills
// the query cache without returning the data, so the router keeps no second
// copy as loaderData. Like every load file, it imports no UI: the router
// keeps loaders in the initial bundle, so UI here would load up front
// (ADR 0036).
export async function loadCardsPage(queryClient: QueryClient): Promise<void> {
  await queryClient.query(lcardQueries.list());
}

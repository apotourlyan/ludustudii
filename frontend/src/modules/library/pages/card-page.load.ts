import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { ApiError } from "@/api/http";
import { lcardQueries } from "@/api/lcards";

// Fills what CardPage reads: the card. Its route's loader calls it. Fills
// the query cache without returning the data, so the router keeps no second
// copy as loaderData. A missing card becomes the route's not-found page,
// CardNotFoundPage. Like every load file, it imports no UI: the router keeps
// loaders in the initial bundle, so UI here would load up front (ADR 0036).
export async function loadCardPage(queryClient: QueryClient, cardId: string): Promise<void> {
  try {
    await queryClient.query(lcardQueries.detail(cardId));
  } catch (error) {
    // A missing card can't be retried into existence, so it isn't an error.
    // For this GET, a 400 can only mean a malformed card ID in the path.
    if (
      error instanceof ApiError &&
      error.failure.kind === "http" &&
      (error.failure.status === 400 || error.failure.status === 404)
    ) {
      throw notFound();
    }
    throw error;
  }
}

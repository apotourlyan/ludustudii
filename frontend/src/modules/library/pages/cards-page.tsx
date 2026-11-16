import type { QueryClient } from "@tanstack/react-query";

import { lcardQueries } from "@/api/lcards";

import { LearningCardsOverview } from "../components/learning-cards-overview";

// Fills what CardsPage reads: the list. Its route's loader calls it. Fills
// the query cache without returning the data, so the router keeps no second
// copy as loaderData.
export async function loadCardsPage(queryClient: QueryClient): Promise<void> {
  await queryClient.query(lcardQueries.list());
}

// The learning cards, one at a time in a carousel.
export function CardsPage() {
  return <LearningCardsOverview />;
}

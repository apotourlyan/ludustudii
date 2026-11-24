import type { QueryClient } from "@tanstack/react-query";

import { loadLearningCardPage } from "./learning-card-page.load";

// Fills what EditLearningCardPage reads: the card, exactly what
// LearningCardPage reads, so it fills it the same way, a missing card
// included. Once the two pages read different data, this gets a body of its
// own.
export function loadEditLearningCardPage(queryClient: QueryClient, cardId: string): Promise<void> {
  return loadLearningCardPage(queryClient, cardId);
}

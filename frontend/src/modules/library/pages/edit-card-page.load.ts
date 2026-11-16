import type { QueryClient } from "@tanstack/react-query";

import { loadCardPage } from "./card-page.load";

// Fills what EditCardPage reads: the card, exactly what CardPage reads, so
// it fills it the same way, a missing card included. Once the two pages
// read different data, this gets a body of its own.
export function loadEditCardPage(queryClient: QueryClient, cardId: string): Promise<void> {
  return loadCardPage(queryClient, cardId);
}

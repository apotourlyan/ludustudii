import { createFileRoute } from "@tanstack/react-router";

import { CardsPage, loadCardsPage, validateCardsPageSearch } from "@/modules/library";

export const Route = createFileRoute("/library/cards/")({
  validateSearch: validateCardsPageSearch,
  loader: ({ context: { queryClient } }) => loadCardsPage(queryClient),
  component: CardsPage,
});

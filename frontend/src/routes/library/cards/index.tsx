import { createFileRoute } from "@tanstack/react-router";

import { CardsPage, loadCardsPage } from "@/modules/library";

export const Route = createFileRoute("/library/cards/")({
  loader: ({ context: { queryClient } }) => loadCardsPage(queryClient),
  component: CardsPage,
});

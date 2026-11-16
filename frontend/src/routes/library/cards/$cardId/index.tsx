import { createFileRoute } from "@tanstack/react-router";

import { CardNotFoundPage, CardPage, loadCardPage } from "@/modules/library";

export const Route = createFileRoute("/library/cards/$cardId/")({
  loader: ({ context: { queryClient }, params: { cardId } }) => loadCardPage(queryClient, cardId),
  component: LearningCardRoute,
  notFoundComponent: CardNotFoundPage,
});

function LearningCardRoute() {
  const { cardId } = Route.useParams();

  return <CardPage cardId={cardId} />;
}

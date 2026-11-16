import { createFileRoute } from "@tanstack/react-router";

import { CardNotFoundPage, EditCardPage, loadEditCardPage } from "@/modules/library";

export const Route = createFileRoute("/library/cards/$cardId/edit")({
  loader: ({ context: { queryClient }, params: { cardId } }) =>
    loadEditCardPage(queryClient, cardId),
  component: LearningCardEditRoute,
  notFoundComponent: CardNotFoundPage,
});

function LearningCardEditRoute() {
  const { cardId } = Route.useParams();

  return <EditCardPage cardId={cardId} />;
}

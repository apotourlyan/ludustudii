import { createFileRoute } from "@tanstack/react-router";

import {
  LearningCardEditPage,
  LearningCardNotFoundPage,
  loadLearningCardEditPage,
} from "@/modules/library";

export const Route = createFileRoute("/library/cards/$cardId/edit")({
  loader: ({ context: { queryClient }, params: { cardId } }) =>
    loadLearningCardEditPage(queryClient, cardId),
  component: LearningCardEditRoute,
  notFoundComponent: LearningCardNotFoundPage,
});

function LearningCardEditRoute() {
  const { cardId } = Route.useParams();

  return <LearningCardEditPage cardId={cardId} />;
}

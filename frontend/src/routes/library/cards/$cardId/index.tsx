import { createFileRoute } from "@tanstack/react-router";

import {
  LearningCardNotFoundPage,
  LearningCardPage,
  loadLearningCardPage,
} from "@/modules/library";

export const Route = createFileRoute("/library/cards/$cardId/")({
  loader: ({ context: { queryClient }, params: { cardId } }) =>
    loadLearningCardPage(queryClient, cardId),
  component: LearningCardRoute,
  notFoundComponent: LearningCardNotFoundPage,
});

function LearningCardRoute() {
  const { cardId } = Route.useParams();

  return <LearningCardPage cardId={cardId} />;
}

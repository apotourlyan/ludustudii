import { createFileRoute } from "@tanstack/react-router";

import {
  EditLearningCardPage,
  LearningCardNotFoundPage,
  loadEditLearningCardPage,
} from "@/modules/library";

export const Route = createFileRoute("/library/cards/$cardId/edit")({
  loader: ({ context: { queryClient }, params: { cardId } }) =>
    loadEditLearningCardPage(queryClient, cardId),
  component: LearningCardEditRoute,
  notFoundComponent: LearningCardNotFoundPage,
});

function LearningCardEditRoute() {
  const { cardId } = Route.useParams();

  return <EditLearningCardPage cardId={cardId} />;
}

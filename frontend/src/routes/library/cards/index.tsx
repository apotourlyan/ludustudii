import { createFileRoute } from "@tanstack/react-router";

import {
  LearningCardsPage,
  loadLearningCardsPage,
  validateLearningCardsPageSearch,
} from "@/modules/library";

export const Route = createFileRoute("/library/cards/")({
  validateSearch: validateLearningCardsPageSearch,
  loader: ({ context: { queryClient } }) => loadLearningCardsPage(queryClient),
  component: LearningCardsPage,
});

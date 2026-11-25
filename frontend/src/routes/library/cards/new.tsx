import { createFileRoute } from "@tanstack/react-router";

import { NewLearningCardPage } from "@/modules/library";

export const Route = createFileRoute("/library/cards/new")({
  component: NewLearningCardPage,
});

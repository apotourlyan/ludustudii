import { createFileRoute } from "@tanstack/react-router";

import { LearningCardNewPage } from "@/modules/library";

export const Route = createFileRoute("/library/cards/new")({
  component: LearningCardNewPage,
});

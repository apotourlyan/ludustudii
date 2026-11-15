import { createFileRoute } from "@tanstack/react-router";

import { NewCardPage } from "@/modules/library";

export const Route = createFileRoute("/learning-card")({
  component: NewCardPage,
});

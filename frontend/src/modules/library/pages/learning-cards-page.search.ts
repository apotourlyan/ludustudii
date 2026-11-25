import type { SearchSchemaInput } from "@tanstack/react-router";

import { parseLearningCardsView, type LearningCardsView } from "../model/learning-cards-view";

// The overview's search params: its display state, which lives in the URL
// so a reload, Back or a link keeps it. Its route's validateSearch is this
// function. Like a load file, it imports no UI: the router keeps it in the
// initial bundle. A link may leave view out, so the input marks it optional
// (SearchSchemaInput), while the page always reads one.
export function validateLearningCardsPageSearch(
  search: { view?: LearningCardsView } & SearchSchemaInput,
): {
  view: LearningCardsView;
} {
  return { view: parseLearningCardsView(search.view) };
}

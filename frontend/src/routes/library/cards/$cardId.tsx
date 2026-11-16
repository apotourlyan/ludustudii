import { createFileRoute, notFound } from "@tanstack/react-router";

import { ApiError } from "@/api/http";
import { lcardQueries } from "@/api/lcards";
import { CardNotFoundPage, EditCardPage } from "@/modules/library";

export const Route = createFileRoute("/library/cards/$cardId")({
  // Fill the query cache without returning the data, so the router keeps no
  // second copy as loaderData.
  loader: async ({ context: { queryClient }, params: { cardId } }) => {
    try {
      await queryClient.query(lcardQueries.detail(cardId));
    } catch (error) {
      // A missing card can't be retried into existence, so it isn't an error.
      // For this GET, a 400 can only mean a malformed card ID in the path.
      if (
        error instanceof ApiError &&
        error.failure.kind === "http" &&
        (error.failure.status === 400 || error.failure.status === 404)
      ) {
        throw notFound();
      }
      throw error;
    }
  },
  component: LearningCardEditRoute,
  notFoundComponent: CardNotFoundPage,
});

function LearningCardEditRoute() {
  const { cardId } = Route.useParams();

  return <EditCardPage cardId={cardId} />;
}

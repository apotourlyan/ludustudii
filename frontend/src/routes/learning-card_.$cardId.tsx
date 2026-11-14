import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { ApiError } from "@/api/http";
import { lcardQueries } from "@/api/lcards";
import { LearningCardForm } from "@/components/learning-card-form";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/learning-card_/$cardId")({
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
  notFoundComponent: LearningCardNotFound,
});

function LearningCardEditRoute() {
  const { cardId } = Route.useParams();
  const { data: card } = useSuspenseQuery(lcardQueries.detail(cardId));

  return <LearningCardForm key={card.id} card={card} />;
}

function LearningCardNotFound() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <Card>
        <CardContent className="space-y-3">
          <p>This card doesn't exist. It may have been deleted.</p>
          <Link to="/learning-cards" className="text-sm text-primary underline underline-offset-4">
            Back to learning cards
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

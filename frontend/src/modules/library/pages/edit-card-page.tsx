import { useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { notFound, useNavigate } from "@tanstack/react-router";

import { ApiError } from "@/api/http";
import { lcardQueries } from "@/api/lcards";

import { LearningCardForm } from "../components/learning-card-form";

// Fills what EditCardPage reads: the card. Its route's loader calls it. Fills
// the query cache without returning the data, so the router keeps no second
// copy as loaderData. A missing card becomes the route's not-found page,
// CardNotFoundPage.
export async function loadEditCardPage(queryClient: QueryClient, cardId: string): Promise<void> {
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
}

// Edits a learning card, then goes back to the list.
export function EditCardPage({ cardId }: { cardId: string }) {
  const { data: card } = useSuspenseQuery(lcardQueries.detail(cardId));
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Update Card</h1>
      <LearningCardForm
        key={card.id}
        card={card}
        onSaved={() => navigate({ to: "/library/cards" })}
      />
    </div>
  );
}

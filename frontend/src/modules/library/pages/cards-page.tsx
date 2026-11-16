import { useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { lcardQueries } from "@/api/lcards";

import { LearningCardCarousel } from "../components/learning-card-carousel";

// Fills what CardsPage reads: the list. Its route's loader calls it. Fills
// the query cache without returning the data, so the router keeps no second
// copy as loaderData.
export async function loadCardsPage(queryClient: QueryClient): Promise<void> {
  await queryClient.query(lcardQueries.list());
}

// The learning cards, one at a time in a carousel.
export function CardsPage() {
  const { data: cards } = useSuspenseQuery(lcardQueries.list());

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Learning Cards</h1>
        <Link to="/library/cards/new" className="text-sm text-primary underline underline-offset-4">
          Add Card
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="text-muted-foreground">No learning cards yet. Add a card to get started.</p>
      ) : (
        <LearningCardCarousel cards={cards} />
      )}
    </div>
  );
}

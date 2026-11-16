import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { lcardQueries } from "@/api/lcards";

import { LearningCardCarousel } from "../components/learning-card-carousel";

// The learning cards, one at a time in a carousel. Reads what
// loadCardsPage, in cards-page.load.ts, fills.
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

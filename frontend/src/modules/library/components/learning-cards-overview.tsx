import type { LearningCard } from "@/api/lcards";
import type { CollectionView } from "@/shared/lib/collection-view";

import { LearningCardGrid } from "./learning-card-grid";
import { LearningCardList } from "./learning-card-list";

// The cards in the overview's view, `view`, as of `now`, or the empty state
// when there are none. The list and the grid start at
// initialScrollOffset.
export function LearningCardsOverview({
  cards,
  view,
  now,
  initialScrollOffset,
}: {
  cards: LearningCard[];
  view: CollectionView;
  now: number;
  initialScrollOffset: number;
}) {
  if (cards.length === 0) {
    return <LearningCardsEmptyState />;
  }

  const CardsViewComponent = view === "list" ? LearningCardList : LearningCardGrid;

  return <CardsViewComponent cards={cards} now={now} initialScrollOffset={initialScrollOffset} />;
}

// What the overview shows before there are any cards.
function LearningCardsEmptyState() {
  return <p className="text-muted-foreground">No learning cards yet. Add a card to get started.</p>;
}

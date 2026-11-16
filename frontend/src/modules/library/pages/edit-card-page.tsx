import { useSuspenseQuery } from "@tanstack/react-query";

import { lcardQueries } from "@/api/lcards";

import { LearningCardForm } from "../components/learning-card-form";

// Edits a learning card. Its route's loader fills the card's query and turns
// a missing card into CardNotFoundPage.
export function EditCardPage({ cardId }: { cardId: string }) {
  const { data: card } = useSuspenseQuery(lcardQueries.detail(cardId));

  return <LearningCardForm key={card.id} card={card} />;
}

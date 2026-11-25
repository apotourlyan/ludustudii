import { useSuspenseQuery } from "@tanstack/react-query";
import { linkOptions, useNavigate } from "@tanstack/react-router";

import { lcardQueries } from "@/api/lcards";

import { LearningCardForm } from "../components/learning-card-form";

// Edits a learning card, then shows it on its page, as Cancel does. Reads
// what loadEditLearningCardPage, in edit-learning-card-page.load.ts, fills; a
// missing card never reaches it.
export function EditLearningCardPage({ cardId }: { cardId: string }) {
  const { data: card } = useSuspenseQuery(lcardQueries.detail(cardId));
  const navigate = useNavigate();
  const cancelLink = linkOptions({ to: "/library/cards/$cardId", params: { cardId } });

  // The promise is returned, not voided: the form awaits onSaved and stays
  // in its saving state until the card's page has loaded.
  function handleSaved() {
    return navigate({ to: "/library/cards/$cardId", params: { cardId } });
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Update card</h1>
      <LearningCardForm key={card.id} card={card} cancelLink={cancelLink} onSaved={handleSaved} />
    </div>
  );
}

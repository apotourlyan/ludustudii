import { linkOptions, useNavigate } from "@tanstack/react-router";

import type { LearningCard } from "@/api/lcards";

import { LearningCardForm } from "../components/learning-card-form";

// Adds a learning card, then shows it on its page. Cancel goes back to the
// list.
export function NewLearningCardPage() {
  const navigate = useNavigate();
  const cancelLink = linkOptions({ to: "/library/cards" });

  // The form is used up once the card exists, so the card's page replaces
  // it in the history, and Back returns to where the user came from. The
  // promise is returned, not voided: the form awaits onSaved and stays in
  // its saving state until the card's page has loaded.
  function handleSaved(card: Pick<LearningCard, "id">) {
    return navigate({ to: "/library/cards/$cardId", params: { cardId: card.id }, replace: true });
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Add card</h1>
      <LearningCardForm cancelLink={cancelLink} onSaved={handleSaved} />
    </div>
  );
}

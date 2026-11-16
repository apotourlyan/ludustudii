import { useNavigate } from "@tanstack/react-router";

import { LearningCardForm } from "../components/learning-card-form";

// Adds a learning card, then shows it on its page. The form is used up
// once the card exists, so the card's page replaces it in the history, and
// Back returns to where the user came from. Cancel goes back to the list.
export function NewCardPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Add Card</h1>
      <LearningCardForm
        cancel={{ to: "/library/cards" }}
        onSaved={(card) =>
          navigate({ to: "/library/cards/$cardId", params: { cardId: card.id }, replace: true })
        }
      />
    </div>
  );
}

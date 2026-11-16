import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { lcardQueries } from "@/api/lcards";

import { LearningCardForm } from "../components/learning-card-form";

// Edits a learning card, then goes back to the list. Reads what
// loadEditCardPage, in edit-card-page.load.ts, fills; a missing card never
// reaches it.
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

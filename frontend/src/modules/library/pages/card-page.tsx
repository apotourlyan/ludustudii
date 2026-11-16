import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { lcardQueries } from "@/api/lcards";

import {
  DeleteLearningCardButton,
  UpdateLearningCardLink,
} from "../components/learning-card-actions";
import { LearningCardDisplay } from "../components/learning-card-view";

const LINK = "text-sm text-primary underline underline-offset-4";

// One learning card, its title the page's heading. Reads what loadCardPage,
// in card-page.load.ts, fills; a missing card never reaches it.
//
// The card sits where the preview does on the edit page, in the first of
// the same two columns, below a row as tall as that page's heading, so
// opening the editor doesn't move it.
export function CardPage({ cardId }: { cardId: string }) {
  const { data: card } = useSuspenseQuery(lcardQueries.detail(cardId));
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex min-h-7 items-center justify-between gap-4">
        {/* Exact, so it isn't marked as the current page on this card's URL below it. */}
        <Link to="/library/cards" activeOptions={{ exact: true }} className={LINK}>
          Back to learning cards
        </Link>
        <Link to="/library/cards/new" className={LINK}>
          Add Card
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <LearningCardDisplay
          card={card}
          pageHeading
          actions={
            <div className="flex gap-2">
              <UpdateLearningCardLink card={card} />
              <DeleteLearningCardButton
                card={card}
                // The card is gone, so its page replaces itself in the
                // history with the list, and Back doesn't show "Card not found".
                onDeleted={() => void navigate({ to: "/library/cards", replace: true })}
              />
            </div>
          }
        />
      </div>
    </div>
  );
}

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { lcardQueries } from "@/api/lcards";

import { DeleteLearningCardButton } from "../components/delete-learning-card-button";
import { UpdateLearningCardLink } from "../components/learning-card-actions";
import { LearningCardDisplay } from "../components/learning-card-display";

// One learning card, its title the page's heading. Reads what
// loadLearningCardPage, in learning-card-page.load.ts, fills; a missing card
// never reaches it.
//
// The card sits where the preview does on the edit page, in the first of
// the same two columns, below a row as tall as that page's heading, so
// opening the editor doesn't move it. The row holds the link to a new
// card, at the card's right edge.
export function LearningCardPage({ cardId }: { cardId: string }) {
  const { data: card } = useSuspenseQuery(lcardQueries.detail(cardId));
  const navigate = useNavigate();

  // The card is gone, so its page replaces itself in the history with the
  // list, and Back doesn't show "Card not found".
  function handleDeleted() {
    void navigate({ to: "/library/cards", replace: true });
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-6 flex min-h-7 items-center justify-end">
            <Link
              to="/library/cards/new"
              className="text-sm text-primary underline underline-offset-4"
            >
              Add card
            </Link>
          </div>
          <LearningCardDisplay
            card={card}
            titleIsPageHeading
            actions={
              <div className="flex gap-2">
                <UpdateLearningCardLink card={card} />
                <DeleteLearningCardButton card={card} onDeleted={handleDeleted} />
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useElementScrollRestoration, useNavigate, useSearch } from "@tanstack/react-router";

import { lcardQueries } from "@/api/lcards";
import { useNow } from "@/shared/lib/use-now";

import { CardsViewSwitch } from "../components/cards-view-switch";
import { LearningCardGrid } from "../components/learning-card-grid";
import { LearningCardList } from "../components/learning-card-list";

// The learning cards' overview, in the view its URL names (?view=list or
// ?view=grid). Reads what loadCardsPage, in cards-page.load.ts, fills, and
// the search params validateCardsPageSearch, in cards-page.search.ts,
// checks.
export function CardsPage() {
  const { data: cards } = useSuspenseQuery(lcardQueries.list());
  const { view } = useSearch({ from: "/library/cards/" });
  const navigate = useNavigate({ from: "/library/cards/" });
  // The time the views mark recently created and updated cards against,
  // read once for all of them and moved on every minute, so a mark goes
  // when its window ends without anything else re-rendering the page.
  const now = useNow();
  // Where the router is about to scroll the window: the position Back
  // returns to, or the top. The views render only what is near it, so they
  // start there instead of rendering the top first.
  const initialScrollOffset =
    useElementScrollRestoration({ getElement: () => window })?.scrollY ?? 0;
  const CardsView = view === "list" ? LearningCardList : LearningCardGrid;
  const empty = cards.length === 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Learning Cards</h1>
        <div className="flex items-center gap-4">
          <CardsViewSwitch
            view={view}
            // The view is display state: switching it replaces the history
            // entry, so Back leaves the page instead of stepping through
            // the switches.
            onChange={(next) =>
              void navigate({ search: (prev) => ({ ...prev, view: next }), replace: true })
            }
          />
          <Link
            to="/library/cards/new"
            className="text-sm text-primary underline underline-offset-4"
          >
            Add Card
          </Link>
        </div>
      </div>

      {empty ? (
        <p className="text-muted-foreground">No learning cards yet. Add a card to get started.</p>
      ) : (
        <CardsView cards={cards} now={now} initialScrollOffset={initialScrollOffset} />
      )}
    </div>
  );
}

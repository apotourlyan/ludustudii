import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useElementScrollRestoration, useNavigate, useSearch } from "@tanstack/react-router";

import { lcardQueries } from "@/api/lcards";

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
  // Where the router is about to scroll the window: the position Back
  // returns to, or the top. The views render only what is near it, so they
  // start there instead of rendering the top first.
  const initialScrollOffset =
    useElementScrollRestoration({ getElement: () => window })?.scrollY ?? 0;

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

      {cards.length === 0 ? (
        <p className="text-muted-foreground">No learning cards yet. Add a card to get started.</p>
      ) : view === "list" ? (
        <LearningCardList cards={cards} initialScrollOffset={initialScrollOffset} />
      ) : (
        <LearningCardGrid cards={cards} initialScrollOffset={initialScrollOffset} />
      )}
    </div>
  );
}

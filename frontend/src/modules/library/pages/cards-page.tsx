import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useElementScrollRestoration, useNavigate, useSearch } from "@tanstack/react-router";

import { lcardQueries } from "@/api/lcards";
import { useNow } from "@/shared/lib/use-now";

import { CardsOverview } from "../components/cards-overview";
import { CardsViewSwitch } from "../components/cards-view-switch";
import type { CardsView } from "../model/cards-view";

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

  // The view is display state: switching it replaces the history entry, so
  // Back leaves the page instead of stepping through the switches.
  function handleViewChange(next: CardsView) {
    void navigate({ search: (prev) => ({ ...prev, view: next }), replace: true });
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Learning cards</h1>
        <div className="flex items-center gap-4">
          <CardsViewSwitch view={view} onChange={handleViewChange} />
          <Link
            to="/library/cards/new"
            className="text-sm text-primary underline underline-offset-4"
          >
            Add card
          </Link>
        </div>
      </div>

      <CardsOverview
        cards={cards}
        view={view}
        now={now}
        initialScrollOffset={initialScrollOffset}
      />
    </div>
  );
}

// How the cards overview shows the cards: one row each, or a grid.
export type CardsView = "list" | "grid";

// The view a value names, and the list for anything else, or nothing.
export function parseCardsView(value: unknown): CardsView {
  return value === "grid" ? "grid" : "list";
}

// The view a press on the view switch turns on, from the values its
// toggle group holds after the press and the view that was on: the other
// view, when it was pressed, or undefined when the press only released
// the view that was on, which stays on.
export function toggledCardsView(
  pressed: readonly unknown[],
  current: CardsView,
): CardsView | undefined {
  return pressed.find(
    (value): value is CardsView => (value === "list" || value === "grid") && value !== current,
  );
}

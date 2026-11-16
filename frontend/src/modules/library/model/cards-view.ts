// How the cards overview shows the cards: one row each, or a grid.
export type CardsView = "list" | "grid";

// The view a value names, and the list for anything else, or nothing.
export function parseCardsView(value: unknown): CardsView {
  return value === "grid" ? "grid" : "list";
}

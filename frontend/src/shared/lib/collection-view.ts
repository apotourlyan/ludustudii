// How a collection shows its items: one row each, or a grid.
export type CollectionView = "list" | "grid";

// The view a value names, and the list for anything else, or nothing.
export function parseCollectionView(value: unknown): CollectionView {
  return value === "grid" ? "grid" : "list";
}

// The view a press on the view switch turns on, from the values its
// toggle group holds after the press and the view that was on: the other
// view, when it was pressed, or undefined when the press only released
// the view that was on, which stays on.
export function toggledCollectionView(
  pressed: readonly unknown[],
  current: CollectionView,
): CollectionView | undefined {
  return pressed.find(
    (value): value is CollectionView => (value === "list" || value === "grid") && value !== current,
  );
}

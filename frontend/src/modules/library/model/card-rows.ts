// How the overview's virtualized list lays its cards out
// (components/virtual-card-list.view.tsx): rows of `columns` cards of one
// size, `gap` pixels apart, of which only the rows near the window are
// rendered. A card's position counts from 1, as aria-posinset does.

// The rows `count` cards take.
export function rowCount(count: number, columns: number): number {
  return Math.ceil(count / columns);
}

// The row of the card with the given ID, or null for no ID or a card that
// isn't among them.
export function rowOfCard(
  cards: readonly { id: string }[],
  id: string | null,
  columns: number,
): number | null {
  const index = id === null ? -1 : cards.findIndex((card) => card.id === id);
  return index === -1 ? null : Math.floor(index / columns);
}

// The rows to render: `rows`, and `kept` among them in order if it isn't
// already, so the card that holds the focus stays rendered.
export function withRow(rows: readonly number[], kept: number | null): number[] {
  if (kept === null || rows.includes(kept)) return [...rows];
  return [...rows, kept].toSorted((a, b) => a - b);
}

// A rendered row, as the virtualizer measures it: its index, its height,
// and its top from the document's top.
export interface RowBox {
  index: number;
  size: number;
  start: number;
}

export interface CardSlot<Card> {
  card: Card;
  position: number;
  // Where the card sits, as an absolutely placed item of the list.
  style: { height: number; width: string; left: string; transform: string };
}

// The cards of the rendered rows, each with its position among all the
// cards and its place: its row's height and top, less `scrollMargin`, the
// list's own top in the document, and its width and left edge, every card
// as wide as the row allows with `gap` between them.
export function cardSlots<Card>(
  rows: readonly RowBox[],
  cards: readonly Card[],
  { columns, gap, scrollMargin }: { columns: number; gap: number; scrollMargin: number },
): CardSlot<Card>[] {
  // A card's width, and the distance from one card's left edge to the next.
  const width = `((100% - ${(columns - 1) * gap}px) / ${columns})`;
  return rows.flatMap((row) =>
    cards.slice(row.index * columns, (row.index + 1) * columns).map((card, column) => ({
      card,
      position: row.index * columns + column + 1,
      style: {
        height: row.size,
        width: `calc${width}`,
        left: `calc(${column} * (${width} + ${gap}px))`,
        transform: `translateY(${row.start - scrollMargin}px)`,
      },
    })),
  );
}

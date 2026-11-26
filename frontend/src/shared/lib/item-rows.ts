// How a virtualized list lays its items out, such as VirtualItemList's
// (src/shared/components/virtual-item-list.view.tsx): rows of `columns` items
// of one size, `gap` pixels apart, of which only the rows near the window
// are rendered. An item's position counts from 1, as aria-posinset does.

// The rows `count` items take.
export function rowCount(count: number, columns: number): number {
  return Math.ceil(count / columns);
}

// The row of the item with the given ID, or null for no ID or an item that
// isn't among them.
export function rowOfItem(
  items: readonly { id: string }[],
  id: string | null,
  columns: number,
): number | null {
  const index = id === null ? -1 : items.findIndex((item) => item.id === id);
  return index === -1 ? null : Math.floor(index / columns);
}

// The rows to render: `rows`, and `kept` among them in order if it isn't
// already, so the item that holds the focus stays rendered.
export function withRow(rows: readonly number[], kept: number | null): number[] {
  if (kept === null || rows.includes(kept)) {
    return [...rows];
  }
  return [...rows, kept].toSorted((a, b) => a - b);
}

// A rendered row, as the virtualizer measures it: its index, its height,
// and its top from the document's top.
export interface RowBox {
  index: number;
  size: number;
  start: number;
}

export interface ItemSlot<Item> {
  item: Item;
  position: number;
  // Where the item sits, as an absolutely placed element of the list.
  style: { height: number; width: string; left: string; transform: string };
}

// The items of the rendered rows, each with its position among all the
// items and its place: its row's height and top, less `scrollMargin`, the
// list's own top in the document, and its width and left edge, every item
// as wide as the row allows with `gap` between them.
export function itemSlots<Item>(
  rows: readonly RowBox[],
  items: readonly Item[],
  { columns, gap, scrollMargin }: { columns: number; gap: number; scrollMargin: number },
): ItemSlot<Item>[] {
  // An item's width, and the distance from one item's left edge to the next.
  const width = `((100% - ${(columns - 1) * gap}px) / ${columns})`;
  return rows.flatMap((row) =>
    items.slice(row.index * columns, (row.index + 1) * columns).map((item, column) => ({
      item,
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

import { defaultRangeExtractor, useWindowVirtualizer, type Range } from "@tanstack/react-virtual";
import { useCallback, useRef } from "react";

import { itemSlots, rowCount, withRow } from "@/shared/lib/item-rows";
import { useDocumentTop } from "@/shared/lib/use-document-top";

import type { VirtualItemListState } from "./virtual-item-list.state";

// The items as a list named `label`, in rows of `columns` items of one
// size, each rendered by renderItem, with only the rows near the window
// rendered, and `keptRow` too. The page scrolls, with no scroll box of its
// own. Every row is `rowHeight` tall with `gap` between rows and items, so
// the virtualizer's estimate is exact and nothing is measured. `overscan` rows beyond each edge of the window stay
// rendered, enough that the item after the focused one is always there to
// tab to. initialScrollOffset is where the window is about to be scrolled,
// such as the position Back restores, so the first render shows the rows
// there. Takes at least one item: an empty list is its parent's to show.
export function VirtualItemListView<Item extends { id: string }>({
  items,
  label,
  columns,
  rowHeight,
  gap,
  overscan,
  initialScrollOffset,
  renderItem,
  keptRow,
  onFocus,
  onBlur,
}: VirtualItemListState<Item>) {
  const listRef = useRef<HTMLUListElement>(null);
  const scrollMargin = useDocumentTop(listRef);
  const rangeExtractor = useCallback(
    (range: Range) => withRow(defaultRangeExtractor(range), keptRow),
    [keptRow],
  );

  const virtualizer = useWindowVirtualizer({
    count: rowCount(items.length, columns),
    estimateSize: () => rowHeight,
    gap,
    overscan,
    scrollMargin,
    initialOffset: initialScrollOffset,
    rangeExtractor,
  });
  const totalHeight = virtualizer.getTotalSize();
  const slots = itemSlots(virtualizer.getVirtualItems(), items, {
    columns,
    gap,
    scrollMargin: virtualizer.options.scrollMargin,
  });

  return (
    // The items are the list's items, placed in rows: the rows have no
    // element of their own, which a list couldn't hold. Tailwind removes
    // the list's markers, and Safari then drops its list semantics unless
    // the role is explicit. Each rendered item says its place among all the
    // items, since most aren't in the DOM.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the focus handlers only note which item's link or button has the focus; they make the list no more interactive than its items
    <ul
      ref={listRef}
      // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- the explicit role keeps the list a list in Safari's accessibility tree
      role="list"
      aria-label={label}
      className="relative"
      style={{ height: totalHeight }}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {slots.map(({ item, position, style }) => (
        <li
          key={item.id}
          aria-setsize={items.length}
          aria-posinset={position}
          className="absolute top-0"
          style={style}
        >
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

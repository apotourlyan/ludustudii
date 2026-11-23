import { defaultRangeExtractor, useWindowVirtualizer, type Range } from "@tanstack/react-virtual";
import { useCallback, useRef } from "react";

import { useDocumentTop } from "@/shared/lib/use-document-top";

import { cardSlots, rowCount, withRow } from "../model/card-rows";
import type { VirtualCardListState } from "./virtual-card-list.state";

// The list both views of the overview are: the cards as a list named
// "Learning cards", in rows of `columns` cards of one size, with only the
// rows near the window rendered, and `keptRow` too. The page scrolls, with
// no scroll box of its own. Every row is `rowHeight` tall with `gap`
// between rows and cards, so the virtualizer's estimate is exact and
// nothing is measured. `overscan` rows beyond each edge of the window stay
// rendered, enough that the card after the focused one is always there to
// tab to. initialScrollOffset is where the window is about to be scrolled,
// such as the position Back restores, so the first render shows the rows
// there. Takes at least one card: an empty list is its parent's to show.
export function VirtualCardListView({
  cards,
  columns,
  rowHeight,
  gap,
  overscan,
  initialScrollOffset,
  renderCard,
  keptRow,
  onFocus,
  onBlur,
}: VirtualCardListState) {
  const listRef = useRef<HTMLUListElement>(null);
  const scrollMargin = useDocumentTop(listRef);
  const rangeExtractor = useCallback(
    (range: Range) => withRow(defaultRangeExtractor(range), keptRow),
    [keptRow],
  );

  const virtualizer = useWindowVirtualizer({
    count: rowCount(cards.length, columns),
    estimateSize: () => rowHeight,
    gap,
    overscan,
    scrollMargin,
    initialOffset: initialScrollOffset,
    rangeExtractor,
  });
  const slots = cardSlots(virtualizer.getVirtualItems(), cards, {
    columns,
    gap,
    scrollMargin: virtualizer.options.scrollMargin,
  });

  return (
    // The cards are the list's items, placed in rows: the rows have no
    // element of their own, which a list couldn't hold. Tailwind removes
    // the list's markers, and Safari then drops its list semantics unless
    // the role is explicit. Each rendered item says its place among all the
    // cards, since most aren't in the DOM.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the focus handlers only note which card's link or button has the focus; they make the list no more interactive than its items
    <ul
      ref={listRef}
      // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- the explicit role keeps the list a list in Safari's accessibility tree
      role="list"
      aria-label="Learning cards"
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {slots.map(({ card, position, style }) => (
        <li
          key={card.id}
          aria-setsize={cards.length}
          aria-posinset={position}
          className="absolute top-0"
          style={style}
        >
          {renderCard(card)}
        </li>
      ))}
    </ul>
  );
}

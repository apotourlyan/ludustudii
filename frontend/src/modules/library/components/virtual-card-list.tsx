import { defaultRangeExtractor, useWindowVirtualizer, type Range } from "@tanstack/react-virtual";
import { useCallback, useRef, useState, type FocusEvent, type ReactNode } from "react";

import type { LearningCard } from "@/api/lcards";
import { useDocumentTop } from "@/shared/lib/use-document-top";

// The list both views of the overview are: the cards as a list named
// "Learning cards", in rows of `columns` cards of one size, with only the
// rows near the window rendered. The page scrolls, with no scroll box of
// its own. Every row is `rowHeight` tall with `gap` between rows and
// cards, so the virtualizer's estimate is exact and nothing is measured.
// `overscan` rows beyond each edge of the window stay rendered, enough
// that the card after the focused one is always there to tab to. The card
// that holds the keyboard focus stays rendered wherever the window is
// scrolled, so the focus isn't lost and the next Tab goes on from it.
// initialScrollOffset is where the window is about to be scrolled, such as
// the position Back restores, so the first render shows the rows there.
// Takes at least one card: an empty list is its parent's to show.
export function VirtualCardList({
  cards,
  columns,
  rowHeight,
  gap,
  overscan,
  initialScrollOffset,
  renderCard,
}: {
  cards: LearningCard[];
  columns: number;
  rowHeight: number;
  gap: number;
  overscan: number;
  initialScrollOffset: number;
  renderCard: (card: LearningCard) => ReactNode;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const scrollMargin = useDocumentTop(listRef);

  // The focused card's ID, by its item's position, or null when the focus
  // is outside the list. An ID rather than a position, so the right card
  // stays rendered when cards before it are added or removed.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const onFocus = (event: FocusEvent<HTMLUListElement>) => {
    const position = Number(event.target.closest("li")?.getAttribute("aria-posinset"));
    setFocusedId(cards[position - 1]?.id ?? null);
  };
  const onBlur = (event: FocusEvent<HTMLUListElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(null);
  };
  const focusedIndex = focusedId === null ? -1 : cards.findIndex((card) => card.id === focusedId);
  const focusedRow = focusedIndex === -1 ? null : Math.floor(focusedIndex / columns);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const rows = defaultRangeExtractor(range);
      if (focusedRow === null || rows.includes(focusedRow)) return rows;
      return [...rows, focusedRow].toSorted((a, b) => a - b);
    },
    [focusedRow],
  );

  const virtualizer = useWindowVirtualizer({
    count: Math.ceil(cards.length / columns),
    estimateSize: () => rowHeight,
    gap,
    overscan,
    scrollMargin,
    initialOffset: initialScrollOffset,
    rangeExtractor,
  });

  // A card's width, and the distance from one card's left edge to the next.
  const width = `((100% - ${(columns - 1) * gap}px) / ${columns})`;

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
      {virtualizer.getVirtualItems().flatMap((row) =>
        cards.slice(row.index * columns, (row.index + 1) * columns).map((card, column) => (
          <li
            key={card.id}
            aria-setsize={cards.length}
            aria-posinset={row.index * columns + column + 1}
            className="absolute top-0"
            style={{
              height: row.size,
              width: `calc${width}`,
              left: `calc(${column} * (${width} + ${gap}px))`,
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {renderCard(card)}
          </li>
        )),
      )}
    </ul>
  );
}

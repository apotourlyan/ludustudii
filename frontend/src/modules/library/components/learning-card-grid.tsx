import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useRef, useSyncExternalStore } from "react";

import type { LearningCard } from "@/api/lcards";
import { useDocumentTop } from "@/shared/lib/use-document-top";
import { Card, CardTitle } from "@/shared/ui/card";

import { CardTitleMarkdown } from "./card-markdown";
import { LearningCardActions } from "./learning-card-actions";

// Every card is this tall, its title cut to three lines, so the
// virtualizer's estimate of a row is exact and no row is measured.
const CARD_HEIGHT = 144;
const GAP = 16;
// Rows rendered beyond each edge of the window, about a screen's worth, so
// the card after the focused one is always there to tab to.
const OVERSCAN = 4;

// Cards per row by the window's width, widest first: Tailwind's lg, md and
// sm breakpoints, and one below sm.
const COLUMNS: [query: string, columns: number][] = [
  ["(min-width: 64rem)", 4],
  ["(min-width: 48rem)", 3],
  ["(min-width: 40rem)", 2],
];

function subscribeToColumns(onChange: () => void): () => void {
  const queries = COLUMNS.map(([query]) => window.matchMedia(query));
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}

function currentColumns(): number {
  return COLUMNS.find(([query]) => window.matchMedia(query).matches)?.[1] ?? 1;
}

// The cards as a grid of titles, each card the same size, with its actions.
// Only the rows near the window are rendered; the page scrolls, with no
// scroll box of its own. initialScrollOffset is where the window is about
// to be scrolled, such as the position Back restores, so the first render
// shows the rows there. Takes at least one card: an empty list is its
// parent's to show.
export function LearningCardGrid({
  cards,
  initialScrollOffset,
}: {
  cards: LearningCard[];
  initialScrollOffset: number;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const scrollMargin = useDocumentTop(listRef);
  // Read while rendering, so the first render already has the rows the
  // window's width makes, and the page its full height for Back to restore.
  const columns = useSyncExternalStore(subscribeToColumns, currentColumns);
  const virtualizer = useWindowVirtualizer({
    count: Math.ceil(cards.length / columns),
    estimateSize: () => CARD_HEIGHT,
    gap: GAP,
    overscan: OVERSCAN,
    scrollMargin,
    initialOffset: initialScrollOffset,
  });

  // A card's width, and the distance from one card's left edge to the next.
  const width = `((100% - ${(columns - 1) * GAP}px) / ${columns})`;

  return (
    // The cards are the list's items, placed in rows: the rows have no
    // element of their own, which a list couldn't hold. Tailwind removes
    // the list's markers, and Safari then drops its list semantics unless
    // the role is explicit. Each rendered item says its place among all the
    // cards, since most aren't in the DOM.
    <ul
      ref={listRef}
      // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- the explicit role keeps the list a list in Safari's accessibility tree
      role="list"
      aria-label="Learning cards"
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
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
              left: `calc(${column} * (${width} + ${GAP}px))`,
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            <Card className="h-full gap-3 px-4">
              <CardTitle className="line-clamp-3 wrap-break-word">
                <CardTitleMarkdown>{card.title}</CardTitleMarkdown>
              </CardTitle>
              <div className="mt-auto self-end">
                <LearningCardActions card={card} />
              </div>
            </Card>
          </li>
        )),
      )}
    </ul>
  );
}

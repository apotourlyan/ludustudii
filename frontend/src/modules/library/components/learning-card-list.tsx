import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import type { LearningCard } from "@/api/lcards";
import { useDocumentTop } from "@/shared/lib/use-document-top";
import { Card, CardTitle } from "@/shared/ui/card";

import { CardTitleMarkdown } from "./card-markdown";
import { LearningCardActions } from "./learning-card-actions";

// Every row is this tall, its title cut to one line, so the virtualizer's
// estimate is exact and no row is measured.
const ROW_HEIGHT = 48;
const ROW_GAP = 8;
// Rows rendered beyond each edge of the window, about a screen's worth, so
// the row after the focused one is always there to tab to.
const OVERSCAN = 12;

// The cards as a list of titles, one row each with its actions. Only the
// rows near the window are rendered; the page scrolls, with no scroll box
// of its own. initialScrollOffset is where the window is about to be
// scrolled, such as the position Back restores, so the first render shows
// the rows there. Takes at least one card: an empty list is its parent's
// to show.
export function LearningCardList({
  cards,
  initialScrollOffset,
}: {
  cards: LearningCard[];
  initialScrollOffset: number;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const scrollMargin = useDocumentTop(listRef);
  const virtualizer = useWindowVirtualizer({
    count: cards.length,
    estimateSize: () => ROW_HEIGHT,
    gap: ROW_GAP,
    overscan: OVERSCAN,
    scrollMargin,
    initialOffset: initialScrollOffset,
    getItemKey: (index) => cards[index]!.id,
  });

  return (
    // Tailwind removes the list's markers, and Safari then drops its list
    // semantics unless the role is explicit. Each rendered item says its
    // place among all the cards, since most aren't in the DOM.
    <ul
      ref={listRef}
      // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- the explicit role keeps the list a list in Safari's accessibility tree
      role="list"
      aria-label="Learning cards"
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const card = cards[row.index]!;
        return (
          <li
            key={row.key}
            aria-setsize={cards.length}
            aria-posinset={row.index + 1}
            className="absolute inset-x-0 top-0"
            style={{
              height: row.size,
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            <Card className="h-full flex-row items-center gap-4 px-4 py-0">
              <CardTitle className="min-w-0 flex-1 truncate">
                <CardTitleMarkdown>{card.title}</CardTitleMarkdown>
              </CardTitle>
              <LearningCardActions card={card} />
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

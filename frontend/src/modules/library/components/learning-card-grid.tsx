import { useSyncExternalStore } from "react";

import type { LearningCard } from "@/api/lcards";
import { Card, CardTitle } from "@/shared/ui/card";

import { CardTitleMarkdown } from "./card-markdown";
import { LearningCardActions } from "./learning-card-actions";
import { VirtualCardList } from "./virtual-card-list";

// Cards per row by the window's width, widest first: Tailwind's lg, md and
// sm breakpoints, and one below sm.
const COLUMNS: [query: string, columns: number][] = [
  ["(min-width: 64rem)", 4],
  ["(min-width: 48rem)", 3],
  ["(min-width: 40rem)", 2],
];

// The media queries, created once on first use: the grid reads them on
// every render, and it renders on every scroll.
let mediaQueries: MediaQueryList[] | undefined;
function columnQueries(): MediaQueryList[] {
  return (mediaQueries ??= COLUMNS.map(([query]) => window.matchMedia(query)));
}

function subscribeToColumns(onChange: () => void): () => void {
  for (const query of columnQueries()) query.addEventListener("change", onChange);
  return () => {
    for (const query of columnQueries()) query.removeEventListener("change", onChange);
  };
}

function currentColumns(): number {
  const index = columnQueries().findIndex((query) => query.matches);
  return index === -1 ? 1 : COLUMNS[index]![1];
}

// The cards as a grid of titles, each card the same size, the title cut to
// three lines, with the card's actions at the bottom right. Virtualized by
// VirtualCardList, which takes the same initialScrollOffset.
export function LearningCardGrid({
  cards,
  initialScrollOffset,
}: {
  cards: LearningCard[];
  initialScrollOffset: number;
}) {
  // Read while rendering, so the first render already has the rows the
  // window's width makes, and the page its full height for Back to restore.
  const columns = useSyncExternalStore(subscribeToColumns, currentColumns);

  return (
    <VirtualCardList
      cards={cards}
      columns={columns}
      rowHeight={144}
      gap={16}
      // About a screen's worth of rows.
      overscan={4}
      initialScrollOffset={initialScrollOffset}
      renderCard={(card) => (
        <Card className="h-full gap-3 px-4">
          <CardTitle className="line-clamp-3 wrap-break-word">
            <CardTitleMarkdown>{card.title}</CardTitleMarkdown>
          </CardTitle>
          <div className="mt-auto self-end">
            <LearningCardActions card={card} />
          </div>
        </Card>
      )}
    />
  );
}

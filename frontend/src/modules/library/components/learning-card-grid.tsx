import { useSyncExternalStore } from "react";

import type { LearningCard } from "@/api/lcards";
import { RecentChangeMark } from "@/shared/components/recent-change-mark";
import { VirtualItemList } from "@/shared/components/virtual-item-list";
import { recentChange } from "@/shared/lib/recent-change";
import { Card, CardTitle } from "@/shared/ui/card";

import { LearningCardActions } from "./learning-card-actions";
import { LearningCardTitleMarkdown } from "./learning-card-markdown";

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
  for (const query of columnQueries()) {
    query.addEventListener("change", onChange);
  }
  return () => {
    for (const query of columnQueries()) {
      query.removeEventListener("change", onChange);
    }
  };
}

function currentColumns(): number {
  const index = columnQueries().findIndex((query) => query.matches);
  return index === -1 ? 1 : COLUMNS[index]![1];
}

// The cards as a grid of titles, each card the same size, the title cut to
// three lines, with the card's mark in the top right corner if it was
// created or updated recently, as of `now`, and its actions at the bottom
// right. Virtualized by VirtualItemList, which takes the same
// initialScrollOffset.
export function LearningCardGrid({
  cards,
  now,
  initialScrollOffset,
}: {
  cards: LearningCard[];
  now: number;
  initialScrollOffset: number;
}) {
  // Read while rendering, so the first render already has the rows the
  // window's width makes, and the page its full height for Back to restore.
  const columns = useSyncExternalStore(subscribeToColumns, currentColumns);

  return (
    <VirtualItemList
      items={cards}
      label="Learning cards"
      columns={columns}
      rowHeight={144}
      gap={16}
      // About a screen's worth of rows.
      overscan={4}
      initialScrollOffset={initialScrollOffset}
      renderItem={(card) => <GridCard card={card} now={now} />}
    />
  );
}

// One card in the grid: its mark, its title and its actions.
function GridCard({ card, now }: { card: LearningCard; now: number }) {
  const change = recentChange(card, now);

  return (
    <Card className="relative h-full gap-3 px-4">
      {/* Before the title, so its hidden text is read first, and placed
          in the corner, centered on the title's first line: the card's
          16px padding plus half of what the 20px line has over the 16px
          icon. */}
      <span className="absolute top-4.5 right-4 flex">
        <RecentChangeMark change={change} />
      </span>
      {/* The title stops short of the mark, 16px for the icon and 8px
          between them, on every card, so titles wrap the same way
          whether a card has a mark or not. */}
      <CardTitle className="line-clamp-3 pr-6 wrap-break-word">
        <LearningCardTitleMarkdown>{card.title}</LearningCardTitleMarkdown>
      </CardTitle>
      <div className="mt-auto self-end">
        <LearningCardActions card={card} />
      </div>
    </Card>
  );
}

import type { LearningCard } from "@/api/lcards";
import { Card, CardTitle } from "@/shared/ui/card";

import { recentChange } from "../model/recent-change";
import { CardTitleMarkdown } from "./card-markdown";
import { LearningCardActions } from "./learning-card-actions";
import { RecentChangeMark } from "./recent-change-mark";
import { VirtualCardList } from "./virtual-card-list";

// The cards as a list of titles, one row each, the title cut to one line,
// led by the card's mark if it was created or updated recently, as of
// `now`, with the card's actions on the right. Virtualized by
// VirtualCardList, which takes the same initialScrollOffset.
export function LearningCardList({
  cards,
  now,
  initialScrollOffset,
}: {
  cards: LearningCard[];
  now: number;
  initialScrollOffset: number;
}) {
  return (
    <VirtualCardList
      cards={cards}
      columns={1}
      rowHeight={48}
      gap={8}
      // About a screen's worth of rows.
      overscan={12}
      initialScrollOffset={initialScrollOffset}
      renderCard={(card) => (
        <Card className="h-full flex-row items-center gap-4 px-4 py-0">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* Every row keeps the mark's space, so the titles line up
                whether a row has a mark or not. */}
            <span className="flex size-4 shrink-0">
              <RecentChangeMark change={recentChange(card, now)} />
            </span>
            <CardTitle className="min-w-0 flex-1 truncate">
              <CardTitleMarkdown>{card.title}</CardTitleMarkdown>
            </CardTitle>
          </div>
          <LearningCardActions card={card} />
        </Card>
      )}
    />
  );
}

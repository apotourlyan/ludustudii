import type { LearningCard } from "@/api/lcards";
import { RecentChangeMark } from "@/shared/components/recent-change-mark";
import { VirtualItemList } from "@/shared/components/virtual-item-list";
import { recentChange } from "@/shared/lib/recent-change";
import { Card, CardTitle } from "@/shared/ui/card";

import { LearningCardActions } from "./learning-card-actions";
import { LearningCardTitleMarkdown } from "./learning-card-markdown";

// The cards as a list of titles, one row each, the title cut to one line,
// led by the card's mark if it was created or updated recently, as of
// `now`, with the card's actions on the right. Virtualized by
// VirtualItemList, which takes the same initialScrollOffset.
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
    <VirtualItemList
      items={cards}
      label="Learning cards"
      columns={1}
      rowHeight={48}
      gap={8}
      // About a screen's worth of rows.
      overscan={12}
      initialScrollOffset={initialScrollOffset}
      renderItem={(card) => <ListRow card={card} now={now} />}
    />
  );
}

// One card's row: its mark, its title and its actions.
function ListRow({ card, now }: { card: LearningCard; now: number }) {
  const change = recentChange(card, now);

  return (
    <Card className="h-full flex-row items-center gap-4 px-4 py-0">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Every row keeps the mark's space, so the titles line up
            whether a row has a mark or not. */}
        <span className="flex size-4 shrink-0">
          <RecentChangeMark change={change} />
        </span>
        <CardTitle className="min-w-0 flex-1 truncate">
          <LearningCardTitleMarkdown>{card.title}</LearningCardTitleMarkdown>
        </CardTitle>
      </div>
      <LearningCardActions card={card} />
    </Card>
  );
}

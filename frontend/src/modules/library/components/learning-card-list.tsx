import type { LearningCard } from "@/api/lcards";
import { Card, CardTitle } from "@/shared/ui/card";

import { CardTitleMarkdown } from "./card-markdown";
import { LearningCardActions } from "./learning-card-actions";
import { VirtualCardList } from "./virtual-card-list";

// The cards as a list of titles, one row each, the title cut to one line,
// with the card's actions on the right. Virtualized by VirtualCardList,
// which takes the same initialScrollOffset.
export function LearningCardList({
  cards,
  initialScrollOffset,
}: {
  cards: LearningCard[];
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
          <CardTitle className="min-w-0 flex-1 truncate">
            <CardTitleMarkdown>{card.title}</CardTitleMarkdown>
          </CardTitle>
          <LearningCardActions card={card} />
        </Card>
      )}
    />
  );
}

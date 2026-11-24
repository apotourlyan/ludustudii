import type { ReactNode } from "react";

import type { LearningCard } from "@/api/lcards";
import { CardTitle } from "@/shared/ui/card";

import { CardDescriptionMarkdown, CardTitleMarkdown } from "./card-markdown";
import { LearningCardFrame } from "./learning-card-frame";

// A card's title and description as Markdown, in the frame every mode of
// a card shares, with no strip and no bars. On a page that shows this one
// card, pageHeading makes the title the page's <h1>; the heading inherits
// the title's look.
export function LearningCardDisplay({
  card,
  actions,
  pageHeading = false,
}: {
  card: Pick<LearningCard, "title" | "description">;
  actions?: ReactNode;
  pageHeading?: boolean;
}) {
  const title = <CardTitleMarkdown>{card.title}</CardTitleMarkdown>;

  return (
    <LearningCardFrame
      actions={actions}
      title={{
        content: (
          <CardTitle className="min-w-0 wrap-break-word">
            {pageHeading ? <h1>{title}</h1> : title}
          </CardTitle>
        ),
      }}
      description={{
        content: <CardDescriptionMarkdown>{card.description}</CardDescriptionMarkdown>,
      }}
    />
  );
}

import type { ReactNode } from "react";

import type { LearningCard } from "@/api/lcards";
import { CardTitle } from "@/shared/ui/card";

import { LearningCardFrame } from "./learning-card-frame";
import {
  LearningCardDescriptionMarkdown,
  LearningCardTitleMarkdown,
} from "./learning-card-markdown";

// A card's title and description as Markdown, in the frame every mode of
// a card shares, with no strip and no bars.
export function LearningCardDisplay({
  card,
  actions,
  titleIsPageHeading = false,
}: {
  card: Pick<LearningCard, "title" | "description">;
  actions?: ReactNode;
  titleIsPageHeading?: boolean;
}) {
  return (
    <LearningCardFrame
      actions={actions}
      title={{
        content: <DisplayTitle title={card.title} isPageHeading={titleIsPageHeading} />,
      }}
      description={{
        content: (
          <LearningCardDescriptionMarkdown>{card.description}</LearningCardDescriptionMarkdown>
        ),
      }}
    />
  );
}

// On a page that shows this one card, isPageHeading makes the title the
// page's <h1>; the heading inherits the title's look.
function DisplayTitle({ title, isPageHeading }: { title: string; isPageHeading: boolean }) {
  if (isPageHeading) {
    return (
      <CardTitle className="min-w-0 wrap-break-word">
        <h1>
          <LearningCardTitleMarkdown>{title}</LearningCardTitleMarkdown>
        </h1>
      </CardTitle>
    );
  }

  return (
    <CardTitle className="min-w-0 wrap-break-word">
      <LearningCardTitleMarkdown>{title}</LearningCardTitleMarkdown>
    </CardTitle>
  );
}

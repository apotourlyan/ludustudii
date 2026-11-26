import { useId } from "react";

import type { LearningCard } from "@/api/lcards";
import { CardTitle } from "@/shared/ui/card";

import { isBlank } from "../model/learning-card-fields";
import { LearningCardFrame } from "./learning-card-frame";
import {
  LearningCardDescriptionMarkdown,
  LearningCardTitleMarkdown,
} from "./learning-card-markdown";

// A card as it will look once saved, beside its editor: the same bands as
// the editor's, with plain labels and empty status bars, so the two can
// line up. A section named by its strip. Its parent places it.
export function LearningCardPreview({
  card,
  className,
}: {
  card: Pick<LearningCard, "title" | "description">;
  className?: string;
}) {
  const stripId = useId();

  return (
    <section aria-labelledby={stripId} className={className}>
      {/* The section passes its rows on: when its parent makes it a
          subgrid, the frame is one too, and its bands sit in the parent's
          rows. Otherwise the frame is a grid of its own, one band per row. */}
      <LearningCardFrame
        className="row-span-full grid grid-rows-subgrid"
        strip={<span id={stripId}>Preview</span>}
        title={{
          label: "Title",
          content: (
            // Sets the title's first line on the line of the title field's
            // text beside it: the field's border and top padding, less the
            // difference its smaller font makes. Checked by measuring both.
            <div className="pt-1.5">
              <PreviewTitle title={card.title} />
            </div>
          ),
          status: null,
        }}
        description={{
          label: "Description",
          content: <PreviewDescription description={card.description} />,
          status: null,
        }}
      />
    </section>
  );
}

function PreviewTitle({ title }: { title: string }) {
  if (isBlank(title)) {
    return <Placeholder>Untitled</Placeholder>;
  }
  return (
    <CardTitle className="min-w-0 wrap-break-word">
      <LearningCardTitleMarkdown>{title}</LearningCardTitleMarkdown>
    </CardTitle>
  );
}

function PreviewDescription({ description }: { description: string }) {
  if (isBlank(description)) {
    return <Placeholder>Nothing to preview yet</Placeholder>;
  }
  return <LearningCardDescriptionMarkdown>{description}</LearningCardDescriptionMarkdown>;
}

function Placeholder({ children }: { children: string }) {
  return <p className="text-muted-foreground">{children}</p>;
}

import { useId } from "react";

import type { LearningCard } from "@/api/lcards";
import { CardTitle } from "@/shared/ui/card";

import { isBlank } from "../model/card-fields";
import { CardDescriptionMarkdown, CardTitleMarkdown } from "./card-markdown";
import { LearningCardFrame } from "./learning-card-frame";

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
  const untitled = isBlank(card.title);
  const undescribed = isBlank(card.description);

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
              {untitled ? (
                <Placeholder>Untitled</Placeholder>
              ) : (
                <CardTitle className="min-w-0 wrap-break-word">
                  <CardTitleMarkdown>{card.title}</CardTitleMarkdown>
                </CardTitle>
              )}
            </div>
          ),
          status: null,
        }}
        description={{
          label: "Description",
          content: undescribed ? (
            <Placeholder>Nothing to preview yet</Placeholder>
          ) : (
            <CardDescriptionMarkdown>{card.description}</CardDescriptionMarkdown>
          ),
          status: null,
        }}
      />
    </section>
  );
}

function Placeholder({ children }: { children: string }) {
  return <p className="text-muted-foreground">{children}</p>;
}

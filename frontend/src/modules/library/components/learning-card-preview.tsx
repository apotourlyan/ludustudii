import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { cn } from "cn";
import { useId } from "react";

import type { LearningCard } from "@/api/lcards";
import { CardTitle } from "@/shared/ui/card";

import { CardMarkdown } from "./card-markdown";
import { LearningCardFrame } from "./learning-card-frame";

// A card as it will look once saved, beside its editor: the same bands as
// the editor's, with plain labels and empty status bars, so the two can
// line up. A section named by its strip. Its parent places it.
export function LearningCardPreview({
  card,
  editing = false,
  className,
}: {
  card: Pick<LearningCard, "title" | "description">;
  // Whether the card is being edited beside it: the eye in the strip then
  // drifts, as if watching.
  editing?: boolean;
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
        strip={
          <span className="flex items-center gap-1.5">
            <EyeIcon
              aria-hidden
              className={cn("size-3.5", editing && "animate-watch motion-reduce:animate-none")}
            />
            <span id={stripId}>Preview</span>
          </span>
        }
        title={{
          label: "Title",
          content: isBlank(card.title) ? (
            <Placeholder>Untitled</Placeholder>
          ) : (
            <CardTitle className="min-w-0 wrap-break-word">
              <CardMarkdown>{card.title}</CardMarkdown>
            </CardTitle>
          ),
          status: null,
        }}
        description={{
          label: "Description",
          content: isBlank(card.description) ? (
            <Placeholder>Nothing to preview yet</Placeholder>
          ) : (
            <CardMarkdown>{card.description}</CardMarkdown>
          ),
          status: null,
        }}
      />
    </section>
  );
}

const isBlank = (value: string) => value.trim() === "";

function Placeholder({ children }: { children: string }) {
  return <p className="text-muted-foreground">{children}</p>;
}

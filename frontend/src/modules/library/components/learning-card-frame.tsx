import { cn } from "cn";
import type { ReactNode } from "react";

import { Card, CardAction, CardContent, CardHeader } from "@/shared/ui/card";

// One of a card's sections, the title or the description. Every part but
// the content is a slot: its band is rendered only when the slot is given.
export interface LearningCardFrameSection {
  // The section's own band: the rendered value, or the field.
  content: ReactNode;
  // The label bar: a label on the left, and a meta text, such as a
  // counter, on the right.
  label?: ReactNode;
  meta?: ReactNode;
  // How far the meta's count is toward its limit, from 0 to 1: a thin bar
  // along the label bar's bottom edge. The meta says the same in text.
  progress?: number;
  // The status bar under the content, such as the field's error. null
  // gives an empty bar, which keeps its height.
  status?: ReactNode;
  // Tints the label bar and the status bar with the destructive color.
  invalid?: boolean;
  // Marks the section being edited: a brighter label bar, and the primary
  // color on the hairline under it.
  active?: boolean;
}

export interface LearningCardFrameProps {
  // A band above the title section that names the panel, such as "Edit",
  // at its right edge.
  strip?: ReactNode;
  // Shown next to the title's content, such as buttons.
  actions?: ReactNode;
  title: LearningCardFrameSection;
  description: LearningCardFrameSection;
  // Lets a parent place the frame, for example as a subgrid item.
  className?: string;
}

// A quiet band: small muted text on a background a step off the card's.
const BAND = "flex items-center justify-between gap-2 bg-muted/50 px-(--card-spacing) py-1.5";
const INVALID_BAND = "bg-destructive/10 text-destructive";
// The hairline above a section's content, when the section is active.
const ACTIVE_LINE = "border-t-primary";

// The layout every mode of a learning card shares: an optional strip, then
// the title section and the description section, each as bands stacked
// top to bottom: label bar, content, status bar. A hairline separates the
// bands; the one between the sections is the card's separator. Layout only:
// each mode is its own component and fills the slots.
export function LearningCardFrame({
  strip,
  actions,
  title,
  description,
  className,
}: LearningCardFrameProps) {
  return (
    // The bands are the card's direct children, so a parent can line them
    // up with another frame's in a subgrid.
    <Card className={cn("min-w-0 gap-0 py-0 *:not-first:border-t", className)}>
      {strip !== undefined && (
        <div className={cn(BAND, "justify-end text-muted-foreground")}>{strip}</div>
      )}
      <LabelBar section={title} />
      <CardHeader className={cn("py-(--card-spacing)", title.active && ACTIVE_LINE)}>
        {title.content}
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <StatusBar section={title} />
      <LabelBar section={description} />
      <CardContent
        className={cn(
          "min-w-0 py-(--card-spacing) wrap-break-word",
          description.active && ACTIVE_LINE,
        )}
      >
        {description.content}
      </CardContent>
      <StatusBar section={description} />
    </Card>
  );
}

function LabelBar({ section }: { section: LearningCardFrameSection }) {
  if (section.label === undefined && section.meta === undefined) return null;
  return (
    <div
      className={cn(
        BAND,
        "relative text-muted-foreground transition-colors",
        section.active && "text-foreground",
        section.invalid && INVALID_BAND,
      )}
    >
      {section.label}
      {section.meta !== undefined && <span className="tabular-nums">{section.meta}</span>}
      {section.progress !== undefined && (
        <div
          aria-hidden
          className={cn(
            "absolute bottom-0 left-0 h-0.5 bg-primary/40 transition-[width]",
            section.invalid && "bg-destructive",
          )}
          style={{ width: `${Math.min(Math.max(section.progress, 0), 1) * 100}%` }}
        />
      )}
    </div>
  );
}

function StatusBar({ section }: { section: LearningCardFrameSection }) {
  if (section.status === undefined) return null;
  return (
    // Holds one line when empty, so a message appearing shifts nothing; a
    // message fades in.
    <div
      className={cn(
        BAND,
        "min-h-8 text-muted-foreground transition-colors",
        section.invalid && INVALID_BAND,
      )}
    >
      {section.status !== null && (
        <div className="animate-in duration-200 fade-in-0 motion-reduce:animate-none">
          {section.status}
        </div>
      )}
    </div>
  );
}

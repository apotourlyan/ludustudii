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
  // at its right edge, a step stronger than the bars below it and hatched.
  strip?: ReactNode;
  // Shown next to the title's content, such as buttons.
  actions?: ReactNode;
  title: LearningCardFrameSection;
  description: LearningCardFrameSection;
  // Lets a parent place the frame, for example as a subgrid item.
  className?: string;
}

// What every narrow band shares: one row of small text.
const BAND = "flex items-center gap-2 px-(--card-spacing) py-1.5";
// The label and status bars: quiet, small muted text on a background a
// step off the card's.
const BAR = cn(BAND, "justify-between bg-muted/50 text-muted-foreground transition-colors");
const INVALID_BAR = "bg-destructive/10 text-destructive";
// The strip: a step stronger than the bars, hatched with thin diagonal
// lines in the hairlines' color, its label at the right edge.
const STRIP = cn(
  BAND,
  "justify-end bg-muted text-foreground",
  "bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_6px)]",
);
// The hairline above a section's content, when the section is active.
const ACTIVE_LINE = "border-t-primary";

// The layout every mode of a learning card shares: an optional strip, then
// the title section and the description section, each as bands stacked
// top to bottom: label bar, content, status bar. A hairline separates the
// bands; the one between the sections is the card's separator. Layout only:
// each mode is its own component and fills the slots.
//
// With every slot given, a frame has seven bands, in this order: strip,
// title label bar, title content, title status bar, description label bar,
// description content, description status bar. LearningCardForm's grid has
// a row for each, so a band added, removed or moved here needs the same
// change there (tests/integration/editor-layout.spec.ts checks the two agree).
export function LearningCardFrame({
  strip,
  actions,
  title,
  description,
  className,
}: LearningCardFrameProps) {
  const hasStrip = strip !== undefined;
  const hasActions = actions !== undefined;

  return (
    // The bands are the card's direct children, so a parent can line them
    // up with another frame's in a subgrid.
    <Card className={cn("min-w-0 gap-0 py-0 *:not-first:border-t", className)}>
      {hasStrip && (
        <div className={STRIP}>
          {/* A plate in the strip's own color keeps the hatching off the
              text, and the hatching runs right up to it. */}
          <span className="bg-inherit">{strip}</span>
        </div>
      )}
      <LabelBar section={title} />
      {/* With actions, the title and the actions share one row and are
          centered on it, so a one-line title sits level with the buttons. */}
      <CardHeader
        className={cn(
          "py-(--card-spacing)",
          hasActions && "items-center",
          title.active && ACTIVE_LINE,
        )}
      >
        {title.content}
        {hasActions && <CardAction className="row-span-1 self-center">{actions}</CardAction>}
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
  if (section.label === undefined && section.meta === undefined) {
    return null;
  }
  const hasMeta = section.meta !== undefined;
  // The progress bar's width, the count's share of its limit, at most the
  // whole bar; no bar without a progress.
  const progressWidth =
    section.progress === undefined
      ? undefined
      : `${Math.min(Math.max(section.progress, 0), 1) * 100}%`;

  return (
    <div
      className={cn(
        BAR,
        "relative",
        section.active && "text-foreground",
        section.invalid && INVALID_BAR,
      )}
    >
      {section.label}
      {hasMeta && <span className="tabular-nums">{section.meta}</span>}
      {progressWidth && (
        <div
          aria-hidden
          className={cn(
            "absolute bottom-0 left-0 h-0.5 bg-primary/40 transition-[width]",
            section.invalid && "bg-destructive",
          )}
          style={{ width: progressWidth }}
        />
      )}
    </div>
  );
}

function StatusBar({ section }: { section: LearningCardFrameSection }) {
  if (section.status === undefined) {
    return null;
  }
  const hasMessage = section.status !== null;

  return (
    // Holds one line when empty, so a message appearing shifts nothing; a
    // message fades in.
    <div className={cn(BAR, "min-h-8", section.invalid && INVALID_BAR)}>
      {hasMessage && (
        <div className="animate-in duration-200 fade-in-0 motion-reduce:animate-none">
          {section.status}
        </div>
      )}
    </div>
  );
}

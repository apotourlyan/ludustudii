import { ClockClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockClockwise";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";

import type { RecentChange } from "../model/recent-change";

// The overview's mark for a card created or updated within the last few
// minutes (model/recent-change.ts): a sparkle in blue for a new card, a
// clockwise clock in amber for an updated one, and nothing otherwise. The
// icon is plain, with no frame and nothing to press, so it doesn't read as
// a button. Assistive technology skips it and reads its hidden text, "New"
// or "Updated", instead; render the mark before the card's title, so the
// text comes first. Its parent places it.
export function RecentChangeMark({ change }: { change: RecentChange | undefined }) {
  switch (change) {
    case "new":
      return (
        <>
          <SparkleIcon
            aria-hidden
            data-slot="recent-change-mark"
            className="size-4 shrink-0 text-recent-new"
          />
          <span className="sr-only">New</span>
        </>
      );
    case "updated":
      return (
        <>
          <ClockClockwiseIcon
            aria-hidden
            data-slot="recent-change-mark"
            className="size-4 shrink-0 text-recent-updated"
          />
          <span className="sr-only">Updated</span>
        </>
      );
    case undefined:
      return null;
  }
}

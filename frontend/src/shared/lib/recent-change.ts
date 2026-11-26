// Whether something was created or changed recently enough for a list to
// mark it, so a user who has just added or edited items finds them at a
// glance (ADR 0040). The timestamps are the server's and `now` is the
// device's clock; for a window of minutes, the difference between the two
// doesn't matter, so nothing corrects for it.

// The API's row timestamps (ADR 0040), as RFC 3339 strings.
export type Timestamps = { created_at: string; updated_at: string };

// How long after an item is created or updated it stays marked.
export const RECENT_CHANGE_WINDOW_MS = 5 * 60 * 1000;

export type RecentChange = "new" | "updated";

// "new" when the item was created within the window before `now`, otherwise
// "updated" when it was updated within it, otherwise undefined. An item
// created and then edited within the window is still "new". `now` is in
// milliseconds since the epoch, as Date.now() gives it. A timestamp after
// `now`, from a server clock ahead of the device's, counts as within the
// window.
export function recentChange(timestamps: Timestamps, now: number): RecentChange | undefined {
  if (isWithinWindow(timestamps.created_at, now)) {
    return "new";
  }
  if (isWithinWindow(timestamps.updated_at, now)) {
    return "updated";
  }
  return undefined;
}

function isWithinWindow(timestamp: string, now: number): boolean {
  return now - parseTimestamp(timestamp) < RECENT_CHANGE_WINDOW_MS;
}

// The API's RFC 3339 timestamps carry up to microseconds. Date.parse
// guarantees only milliseconds, so the digits after them are dropped first.
function parseTimestamp(timestamp: string): number {
  return Date.parse(timestamp.replace(/(\.\d{3})\d+/, "$1"));
}

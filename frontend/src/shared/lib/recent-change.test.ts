import { describe, expect, test } from "vitest";

import { RECENT_CHANGE_WINDOW_MS, recentChange } from "./recent-change";

const NOW = Date.parse("2026-11-23T12:00:00.000Z");
const MINUTE = 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();
// A card created and last updated at the given times, in milliseconds.
const card = (createdAt: number, updatedAt = createdAt) => ({
  created_at: iso(createdAt),
  updated_at: iso(updatedAt),
});

test("the window is five minutes", () => {
  expect(RECENT_CHANGE_WINDOW_MS).toBe(5 * MINUTE);
});

describe("a card created", () => {
  test.each([
    { age: "just now", ms: 0 },
    { age: "a minute ago", ms: MINUTE },
    { age: "1 ms inside the window", ms: RECENT_CHANGE_WINDOW_MS - 1 },
  ])("$age is new", ({ ms }) => {
    expect(recentChange(card(NOW - ms), NOW)).toBe("new");
  });

  test.each([
    { age: "exactly the window ago", ms: RECENT_CHANGE_WINDOW_MS },
    { age: "1 ms before the window", ms: RECENT_CHANGE_WINDOW_MS + 1 },
    { age: "a day ago", ms: 24 * 60 * MINUTE },
  ])("$age and not changed since is unmarked", ({ ms }) => {
    expect(recentChange(card(NOW - ms), NOW)).toBeUndefined();
  });

  test("and edited within the window is still new", () => {
    expect(recentChange(card(NOW - 3 * MINUTE, NOW - MINUTE), NOW)).toBe("new");
  });

  // A server clock ahead of the device's.
  test("after now is new", () => {
    expect(recentChange(card(NOW + MINUTE), NOW)).toBe("new");
  });
});

describe("a card created before the window", () => {
  const created = NOW - 24 * 60 * MINUTE;

  test.each([
    { age: "just now", ms: 0 },
    { age: "1 ms inside the window", ms: RECENT_CHANGE_WINDOW_MS - 1 },
    { age: "after now", ms: -MINUTE },
  ])("and updated $age is updated", ({ ms }) => {
    expect(recentChange(card(created, NOW - ms), NOW)).toBe("updated");
  });

  test.each([
    { age: "exactly the window ago", ms: RECENT_CHANGE_WINDOW_MS },
    { age: "1 ms before the window", ms: RECENT_CHANGE_WINDOW_MS + 1 },
  ])("and updated $age is unmarked", ({ ms }) => {
    expect(recentChange(card(created, NOW - ms), NOW)).toBeUndefined();
  });
});

describe("the API's timestamps", () => {
  // The API sends up to microseconds; the digits after milliseconds are
  // dropped, so the window ends at the millisecond.
  test("with microseconds are read to the millisecond", () => {
    const createdAt = "2026-11-23T12:00:00.123456Z";
    const created = Date.parse("2026-11-23T12:00:00.123Z");
    const marked = { created_at: createdAt, updated_at: createdAt };

    expect(recentChange(marked, created + RECENT_CHANGE_WINDOW_MS - 1)).toBe("new");
    expect(recentChange(marked, created + RECENT_CHANGE_WINDOW_MS)).toBeUndefined();
  });

  test("with fewer fraction digits, none, or an offset are read", () => {
    for (const createdAt of [
      "2026-11-23T11:59:00.5Z",
      "2026-11-23T11:59:00Z",
      "2026-11-23T13:59:00+02:00",
    ]) {
      expect(recentChange({ created_at: createdAt, updated_at: createdAt }, NOW)).toBe("new");
    }
  });

  // The type is a string, so a malformed one can arrive; it marks nothing.
  test("that can't be read never mark a card", () => {
    expect(recentChange({ created_at: "yesterday", updated_at: "soon" }, NOW)).toBeUndefined();
    expect(recentChange({ created_at: "", updated_at: iso(NOW) }, NOW)).toBe("updated");
    expect(recentChange({ created_at: iso(NOW), updated_at: "" }, NOW)).toBe("new");
  });
});

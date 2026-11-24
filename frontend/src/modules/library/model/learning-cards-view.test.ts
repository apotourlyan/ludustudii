import { describe, expect, test } from "vitest";

import { parseCardsView, toggledCardsView } from "./learning-cards-view";

test.each(["list", "grid"] as const)("names the %s view", (view) => {
  expect(parseCardsView(view)).toBe(view);
});

test.each([undefined, null, "", "GRID", " grid", "grids", "table", 1, true, {}, ["grid"]])(
  "falls back to the list for %j",
  (value) => {
    expect(parseCardsView(value)).toBe("list");
  },
);

describe("toggledCardsView", () => {
  test.each([
    { pressed: ["list", "grid"], current: "list", next: "grid" },
    { pressed: ["grid", "list"], current: "grid", next: "list" },
    { pressed: ["grid"], current: "list", next: "grid" },
  ] as const)(
    "turns on $next when it is pressed while $current is on",
    ({ pressed, current, next }) => {
      expect(toggledCardsView(pressed, current)).toBe(next);
    },
  );

  test.each(["list", "grid"] as const)("keeps %s on when the press only released it", (current) => {
    expect(toggledCardsView([], current)).toBeUndefined();
    expect(toggledCardsView([current], current)).toBeUndefined();
  });

  test("ignores values that aren't views", () => {
    expect(toggledCardsView(["table", 1, null], "list")).toBeUndefined();
  });
});

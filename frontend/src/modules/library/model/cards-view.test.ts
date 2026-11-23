import { expect, test } from "vitest";

import { parseCardsView } from "./cards-view";

test.each(["list", "grid"] as const)("names the %s view", (view) => {
  expect(parseCardsView(view)).toBe(view);
});

test.each([undefined, null, "", "GRID", " grid", "grids", "table", 1, true, {}, ["grid"]])(
  "falls back to the list for %j",
  (value) => {
    expect(parseCardsView(value)).toBe("list");
  },
);

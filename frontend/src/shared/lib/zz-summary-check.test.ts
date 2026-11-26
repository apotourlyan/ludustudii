// Throwaway: fails on purpose to check the CI job summary.

import { expect, test } from "vitest";

test("deliberately fails | for the <summary> check", () => {
  expect(1 + 1).toBe(3);
});

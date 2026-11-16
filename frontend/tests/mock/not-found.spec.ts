// A card's URL, of its page or its editor, whose ID is malformed or names
// no card shows the not-found page, whose link leads back to the list.

import { expect, test } from "@playwright/test";

import { NOT_FOUND_TEXT } from "../support/cards";

const cases = [
  { name: "a malformed card ID", id: "not-a-card-id" },
  // A valid UUIDv7 that the fake never hands out.
  { name: "a nonexistent card ID", id: "00000000-0000-7000-8000-000000000000" },
];

for (const { name, id } of cases) {
  for (const { url, path } of [
    { url: "page", path: `/library/cards/${id}` },
    { url: "editor", path: `/library/cards/${id}/edit` },
  ]) {
    test(`${name} in a card's ${url} URL shows the not-found page`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Back to learning cards" }).click();

      await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
      await expect(page.getByRole("heading", { name: "Learning Cards", level: 1 })).toBeVisible();
      await expect(page.getByRole("status")).toHaveText("1 / 8");
    });
  }
}

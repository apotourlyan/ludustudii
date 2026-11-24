// The cards overview against the fake backend's seeded scenarios.

import { expect, test } from "@playwright/test";

import { openCardFromList } from "../support/cards";
import { cardItem, cardItems, cardList } from "../support/overview";

// The default scenario's cards, newest first.
const DEFAULT_TITLES = [
  "Mitochondria",
  "日本語: は vs. が",
  "Python list comprehension",
  "Pythagorean theorem",
  "TCP three-way handshake",
  "Ser vs. estar",
  "Photosynthesis",
  "Binary search",
];

test("the default scenario lists its 8 cards, newest first", async ({ page }) => {
  await page.goto("/library/cards");

  await expect(page.getByRole("heading", { name: "Learning cards", level: 1 })).toBeVisible();
  const items = cardItems(page);
  await expect(items).toHaveCount(DEFAULT_TITLES.length);
  for (const [index, title] of DEFAULT_TITLES.entries()) {
    await expect(items.nth(index).getByText(title, { exact: true })).toBeVisible();
    await expect(items.nth(index)).toHaveAttribute("aria-posinset", String(index + 1));
    await expect(items.nth(index)).toHaveAttribute("aria-setsize", String(DEFAULT_TITLES.length));
  }
});

// The overview shows titles only; a card's page shows its description.
test("cards opened from the list render their markdown", async ({ page }) => {
  await page.goto("/library/cards");
  const main = page.getByRole("main");

  // "Ser vs. estar": two "##" headings, one level down as <h3>s, and bold text.
  await openCardFromList(page, cardItem(page, "Ser vs. estar"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ser vs. estar");
  await expect(main.getByRole("heading", { level: 3 })).toHaveText(["Ser", "Estar"]);
  await expect(main.getByRole("strong")).toHaveText(["DOCTOR", "PLACE"]);

  // "Binary search": a numbered list, bold text and inline code.
  await page.goBack();
  await openCardFromList(page, cardItem(page, "Binary search"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Binary search");
  await expect(main.getByRole("listitem")).toHaveCount(3);
  await expect(main.getByRole("strong")).toHaveText("sorted");
  await expect(main.getByRole("code")).toHaveText(["O(log n)", "O(1)"]);
  await expect(main.getByText("**sorted**")).toHaveCount(0);
});

test("the empty scenario shows the empty state", async ({ page }) => {
  await page.goto("/library/cards?scenario=empty");

  await expect(
    page.getByText("No learning cards yet. Add a card to get started.", { exact: true }),
  ).toBeVisible();
  await expect(cardList(page)).toHaveCount(0);
});

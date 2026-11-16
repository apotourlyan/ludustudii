// Every library page has exactly one level-1 heading, its own, and one main
// landmark, the root layout's (ADR 0036). A card's Markdown adds none: its
// title renders inline and its headings start at level 2, which
// card-markdown.spec.ts checks with a card that has "#" lines.

import { expect, test, type Page } from "@playwright/test";

import { NOT_FOUND_TEXT, openCardFromList } from "../support/cards";
import { cardAt, cardItems } from "../support/overview";

const pages: { name: string; heading: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: "the list",
    heading: "Learning Cards",
    open: async (page) => {
      await page.goto("/library/cards");
      await expect(cardItems(page)).toHaveCount(8);
    },
  },
  {
    name: "the empty list",
    heading: "Learning Cards",
    open: async (page) => {
      await page.goto("/library/cards?scenario=empty");
      await expect(
        page.getByText("No learning cards yet. Add a card to get started.", { exact: true }),
      ).toBeVisible();
    },
  },
  {
    name: "the new card page",
    heading: "Add Card",
    open: async (page) => {
      await page.goto("/library/cards/new");
      await expect(page.getByRole("button", { name: "Create Card" })).toBeVisible();
    },
  },
  {
    name: "a card's page",
    heading: "Mitochondria",
    open: async (page) => {
      await page.goto("/library/cards");
      await openCardFromList(page, cardAt(page, 1));
      // The URL changes before the card's page replaces the list, whose
      // items have an Update link each.
      await expect(page.getByRole("link", { name: "Update" })).toHaveCount(1);
    },
  },
  {
    name: "the edit page",
    heading: "Update Card",
    open: async (page) => {
      await page.goto("/library/cards");
      await cardAt(page, 1).getByRole("link", { name: "Update" }).click();
      await expect(page.getByRole("button", { name: "Update Card" })).toBeEnabled();
    },
  },
  ...["", "/edit"].map((suffix) => ({
    name: `the not-found page at a card's ${suffix ? "editor" : "page"} URL`,
    heading: "Card not found",
    open: async (page: Page) => {
      await page.goto(`/library/cards/00000000-0000-7000-8000-000000000000${suffix}`);
      await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toBeVisible();
    },
  })),
];

for (const { name, heading, open } of pages) {
  test(`${name} has one level-1 heading and one main landmark`, async ({ page }) => {
    await open(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveCount(1);
  });
}

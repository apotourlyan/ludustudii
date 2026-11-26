// The overview's marks for cards created or updated in the last five
// minutes, shared by the app and end-to-end tests: an icon hidden from
// assistive technology, and hidden text, "New" or "Updated", read before
// the card's title.

import { expect, type Locator, type Page } from "@playwright/test";

export const RECENT_CHANGE_WINDOW_MS = 5 * 60 * 1000;

export type Mark = "New" | "Updated";

// The mark's icon in an overview's item.
export function markIcon(item: Locator): Locator {
  return item.locator("svg[data-slot=recent-change-mark]");
}

// Checks that the item has this mark: one icon, hidden from assistive
// technology, and the mark's text in the item's accessible content right
// before the title.
export async function expectMark(item: Locator, mark: Mark, title: string): Promise<void> {
  await expect(markIcon(item)).toHaveCount(1);
  await expect(markIcon(item)).toBeVisible();
  await expect(markIcon(item)).toHaveAttribute("aria-hidden", "true");
  // What assistive technology reads, in order: the item's content starts
  // with the mark's text and then the title, with no image for the icon.
  const snapshot = await item.ariaSnapshot();
  expect(snapshot.split("\n")[1]?.trim(), snapshot).toBe(`- text: ${mark} ${title}`);
}

// Checks that the item has no mark: no icon and neither text.
export async function expectNoMark(item: Locator): Promise<void> {
  await expect(markIcon(item)).toHaveCount(0);
  await expect(item.getByText(/^(New|Updated)$/)).toHaveCount(0);
}

// Creates a card through the new card form, from the overview's "Add card"
// link, and returns to the overview through the navigation, without
// reloading the page.
export async function createCardThroughUi(page: Page, title: string): Promise<void> {
  await page.getByRole("main").getByRole("link", { name: "Add card" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Created by a test.");
  await page.getByRole("button", { name: "Create card" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await page.getByRole("link", { name: "Learning cards", exact: true }).click();
}

// Changes the description of the card an overview's item shows, through
// its editor, and returns to the overview through the navigation.
export async function editCardThroughUi(page: Page, item: Locator, title: string): Promise<void> {
  await item.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await page.getByLabel("Description").fill("Edited by a test.");
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await page.getByRole("link", { name: "Learning cards", exact: true }).click();
}

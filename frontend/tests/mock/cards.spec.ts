// Creating, editing and deleting cards through the UI, against the fake
// backend, and where each ends: creating and editing on the card's page,
// deleting on the list. The fake's state lives in the page, so each test
// moves between pages with the app's links: page.goto would load a fresh
// fake. Back is the browser's, which keeps the page and its fake.

import { expect, test, type Page } from "@playwright/test";

import { deleteCard, NOT_FOUND_TEXT, openCardFromList } from "../support/cards";
import { currentSlide } from "../support/carousel";

// The list's own "Add Card" link, not the navigation's.
async function addCardFromList(page: Page): Promise<void> {
  await page.goto("/library/cards");
  await expect(page.getByRole("status")).toHaveText("1 / 8");
  await page.getByRole("main").getByRole("link", { name: "Add Card" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add Card");
}

// Opens the newest card, "Mitochondria", on its page, and returns its ID.
async function openNewestCard(page: Page): Promise<string> {
  await page.goto("/library/cards");
  const id = await openCardFromList(page, currentSlide(page));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
  return id;
}

test("a created card opens on its page, and Back returns to the list", async ({ page }) => {
  await addCardFromList(page);

  await page.getByLabel("Title").fill("Krebs cycle");
  await page.getByLabel("Description").fill("Happens in the **mitochondrial matrix**.");
  await page.getByRole("button", { name: "Create Card" }).click();

  await expect(page).toHaveURL(/\/library\/cards\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Krebs cycle");
  await expect(page.getByRole("main").getByRole("strong")).toHaveText("mitochondrial matrix");

  // The card's page replaced the form in the history.
  await page.goBack();
  await expect(page).toHaveURL(/\/library\/cards$/);
  const slide = currentSlide(page);
  await expect(slide).toHaveAccessibleName("1 of 9");
  await expect(slide.getByText("Krebs cycle", { exact: true })).toBeVisible();
});

test("an edited card shows its changes on its page", async ({ page }) => {
  const id = await openNewestCard(page);
  await page.getByRole("main").getByRole("link", { name: "Update" }).click();

  const title = page.getByLabel("Title");
  await expect(title).toHaveValue("Mitochondria");
  await title.fill("Mitochondrion");
  await page.getByLabel("Description").fill("The *powerhouse* of the cell.");
  await page.getByRole("button", { name: "Update Card" }).click();

  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondrion");
  await expect(page.getByRole("main").getByRole("emphasis")).toHaveText("powerhouse");

  await page.getByRole("link", { name: "Back to learning cards" }).click();
  const slide = currentSlide(page);
  await expect(slide).toHaveAccessibleName("1 of 8");
  await expect(slide.getByText("Mitochondrion", { exact: true })).toBeVisible();
});

test("a card deleted on its page leaves the list, and Back doesn't return to it", async ({
  page,
}) => {
  await openNewestCard(page);

  const dialog = await deleteCard(page, page.getByRole("main"));

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/library\/cards$/);
  const slide = currentSlide(page);
  await expect(slide).toHaveAccessibleName("1 of 7");
  await expect(page.getByText("Mitochondria", { exact: true })).toHaveCount(0);

  // The list replaced the card's page in the history, so Back goes to the
  // entry before it: the list the card was opened from.
  await page.goBack();
  await expect(page).toHaveURL(/\/library\/cards$/);
  await expect(slide).toHaveAccessibleName("1 of 7");
  await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toHaveCount(0);
});

test("a card deleted in the list leaves it", async ({ page }) => {
  await page.goto("/library/cards");
  const slide = currentSlide(page);
  await expect(slide.getByText("Mitochondria", { exact: true })).toBeVisible();

  const dialog = await deleteCard(page, slide);

  await expect(dialog).toBeHidden();
  await expect(slide).toHaveAccessibleName("1 of 7");
  await expect(slide.getByText("日本語: は vs. が", { exact: true })).toBeVisible();
  await expect(page.getByText("Mitochondria", { exact: true })).toHaveCount(0);
});

test("Cancel on the edit page returns to the card's page, unchanged", async ({ page }) => {
  const id = await openNewestCard(page);
  await page.getByRole("main").getByRole("link", { name: "Update" }).click();
  await page.getByLabel("Title").fill("Not saved");

  await page.getByRole("link", { name: "Cancel" }).click();

  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
});

test("Cancel on the new card page returns to the list, with nothing added", async ({ page }) => {
  await addCardFromList(page);
  await page.getByLabel("Title").fill("Not saved");

  await page.getByRole("link", { name: "Cancel" }).click();

  await expect(page).toHaveURL(/\/library\/cards$/);
  await expect(page.getByRole("status")).toHaveText("1 / 8");
  await expect(page.getByText("Not saved", { exact: true })).toHaveCount(0);
});

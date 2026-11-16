// Creating, editing and deleting cards through the UI, against the fake
// backend. The fake's state lives in the page, so each test moves between
// pages with the app's links: page.goto would load a fresh fake.

import { expect, test } from "@playwright/test";

import { deleteFromSlide } from "../support/cards";
import { currentSlide } from "../support/carousel";

test("a created card is the newest in the list", async ({ page }) => {
  await page.goto("/library/cards/new");

  await page.getByLabel("Title").fill("Krebs cycle");
  await page.getByLabel("Description").fill("Happens in the **mitochondrial matrix**.");
  await page.getByRole("button", { name: "Create Card" }).click();
  // The form clears once the card is saved.
  await expect(page.getByLabel("Title")).toHaveValue("");

  await page.getByRole("link", { name: "Learning Cards" }).click();
  const slide = currentSlide(page);
  await expect(slide).toHaveAccessibleName("1 of 9");
  await expect(slide.getByText("Krebs cycle", { exact: true })).toBeVisible();
  await expect(slide.getByRole("strong")).toHaveText("mitochondrial matrix");
});

test("an edited card shows its changes in the list", async ({ page }) => {
  await page.goto("/library/cards");
  await currentSlide(page).getByRole("link", { name: "Update" }).click();

  const title = page.getByLabel("Title");
  await expect(title).toHaveValue("Mitochondria");
  await title.fill("Mitochondrion");
  await page.getByLabel("Description").fill("The *powerhouse* of the cell.");
  await page.getByRole("button", { name: "Update Card" }).click();

  await expect(page).toHaveURL(/\/library\/cards$/);
  const slide = currentSlide(page);
  await expect(slide).toHaveAccessibleName("1 of 8");
  await expect(slide.getByText("Mitochondrion", { exact: true })).toBeVisible();
  await expect(slide.getByRole("emphasis")).toHaveText("powerhouse");
});

test("a deleted card leaves the list", async ({ page }) => {
  await page.goto("/library/cards");
  const slide = currentSlide(page);
  await expect(slide.getByText("Mitochondria", { exact: true })).toBeVisible();

  const dialog = await deleteFromSlide(page, slide);

  await expect(dialog).toBeHidden();
  await expect(slide).toHaveAccessibleName("1 of 7");
  await expect(slide.getByText("日本語: は vs. が", { exact: true })).toBeVisible();
  await expect(page.getByText("Mitochondria", { exact: true })).toHaveCount(0);
});

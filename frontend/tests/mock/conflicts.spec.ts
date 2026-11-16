// A card changed elsewhere since the page loaded it: saving or deleting it
// answers 412, and the page asks the user to reload (ADR 0010).

import { expect, test } from "@playwright/test";

import { cardIdOf, changeCardElsewhere, deleteFromSlide } from "../support/cards";
import { currentSlide } from "../support/carousel";

test("saving a card changed elsewhere shows the conflict", async ({ page }) => {
  await page.goto("/library/cards");
  const id = await cardIdOf(currentSlide(page));
  await currentSlide(page).getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondria");

  await changeCardElsewhere(page, id);
  await page.getByLabel("Title").fill("Mitochondrion");
  await page.getByRole("button", { name: "Update Card" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "This card has changed. Reload it before you save your edits.",
  );
  // The edit stays, so the user can copy it before reloading.
  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}/edit$`));
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondrion");
});

test("deleting a card changed elsewhere shows the conflict", async ({ page }) => {
  await page.goto("/library/cards");
  const slide = currentSlide(page);
  await changeCardElsewhere(page, await cardIdOf(slide));

  const dialog = await deleteFromSlide(page, slide);

  await expect(dialog.getByRole("alert")).toHaveText(
    "This card has changed. Reload it before you delete the card.",
  );
  await expect(dialog).toBeVisible();
});

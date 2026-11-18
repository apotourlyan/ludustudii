// A card changed elsewhere since the page loaded it: the last write wins
// (ADR 0039), so saving replaces the other change and deleting removes the
// card, with nothing to resolve.

import { expect, test } from "@playwright/test";

import { cardIdOf, changeCardElsewhere, deleteCard } from "../support/cards";
import { cardAt, cardItem } from "../support/overview";

test("saving a card changed elsewhere replaces the other change", async ({ page }) => {
  await page.goto("/library/cards");
  const id = await cardIdOf(cardAt(page, 1));
  await cardAt(page, 1).getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondria");

  await changeCardElsewhere(page, id);
  await page.getByLabel("Title").fill("Mitochondrion");
  await page.getByRole("button", { name: "Update Card" }).click();

  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondrion");
});

test("deleting a card changed elsewhere deletes it", async ({ page }) => {
  await page.goto("/library/cards");
  const item = cardAt(page, 1);
  await changeCardElsewhere(page, await cardIdOf(item));

  const dialog = await deleteCard(page, item);

  await expect(dialog).toBeHidden();
  await expect(cardItem(page, "Mitochondria")).toBeHidden();
  await expect(cardItem(page, "Changed elsewhere")).toBeHidden();
});

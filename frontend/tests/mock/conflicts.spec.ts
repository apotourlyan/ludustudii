// A card changed elsewhere since the page loaded it: saving or deleting it
// answers 412, and the page asks the user to reload (ADR 0010). The app
// then reads the card again, so the next attempt starts from its current
// version.

import { expect, test } from "@playwright/test";

import { cardIdOf, changeCardElsewhere, deleteCard } from "../support/cards";
import { cardAt, cardItem } from "../support/overview";

test("saving a card changed elsewhere shows the conflict", async ({ page }) => {
  await page.goto("/library/cards");
  const id = await cardIdOf(cardAt(page, 1));
  await cardAt(page, 1).getByRole("link", { name: "Update" }).click();
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
  const item = cardAt(page, 1);
  await changeCardElsewhere(page, await cardIdOf(item));

  const dialog = await deleteCard(page, item);

  await expect(dialog.getByRole("alert")).toHaveText(
    "This card has changed. Reload it before you delete the card.",
  );
  await expect(dialog).toBeVisible();
});

test("a card reopened after a save conflict is at its current version", async ({ page }) => {
  await page.goto("/library/cards");
  const id = await cardIdOf(cardAt(page, 1));
  await cardAt(page, 1).getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondria");
  await changeCardElsewhere(page, id);
  await page.getByLabel("Title").fill("Mitochondrion");
  await page.getByRole("button", { name: "Update Card" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  // Well within the cached card's staleTime, so only the conflict makes
  // the app read it again.
  await page.getByRole("link", { name: "Learning Cards", exact: true }).click();
  await cardItem(page, "Changed elsewhere").getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Changed elsewhere");
  await page.getByLabel("Title").fill("Mitochondrion");
  await page.getByRole("button", { name: "Update Card" }).click();

  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondrion");
});

test("deleting a card again after a conflict deletes its current version", async ({ page }) => {
  await page.goto("/library/cards");
  await changeCardElsewhere(page, await cardIdOf(cardAt(page, 1)));
  const dialog = await deleteCard(page, cardAt(page, 1));
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  const item = cardItem(page, "Changed elsewhere");
  await expect(item).toBeVisible();
  await deleteCard(page, item);

  await expect(dialog).toBeHidden();
  await expect(item).toBeHidden();
});

// Steps on learning cards shared by the app and end-to-end tests.

import { expect, type Locator, type Page } from "@playwright/test";

// The text of the not-found page for a card.
export const NOT_FOUND_TEXT = "This card doesn't exist. It may have been deleted.";

// The card ID in the path of a card's page, /library/cards/<id>, or of its
// editor, /library/cards/<id>/edit.
export function cardIdFromPath(path: string | null | undefined): string {
  // "new" is the new card form's path, not a card's.
  const id = path?.match(/^\/library\/cards\/(?!new(?:\/|$))([^/]+)(?:\/edit)?$/)?.[1];
  if (!id) {
    throw new Error(`not the path of a card's page or editor: ${JSON.stringify(path)}`);
  }
  return id;
}

// The ID of the card an overview's item shows, from its "Open" link.
export async function cardIdOf(item: Locator): Promise<string> {
  return cardIdFromPath(await item.getByRole("link", { name: "Open" }).getAttribute("href"));
}

// Opens the card an overview's item shows on its page, from the item's
// "Open" link, and returns the card's ID.
export async function openCardFromList(page: Page, item: Locator): Promise<string> {
  const id = await cardIdOf(item);
  await item.getByRole("link", { name: "Open" }).click();
  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  return id;
}

// Deletes the card shown in `scope`, an overview's item or the card's page, through
// its confirmation dialog, and returns the dialog, which closes once the
// request settles; a failure is a toast (support/toasts.ts).
export async function deleteCard(page: Page, scope: Locator): Promise<Locator> {
  await scope.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this learning card?" });
  await dialog.getByRole("button", { name: "Delete" }).click();
  return dialog;
}

// Deletes a card the way another client would, with a request from inside
// the page (see changeCardElsewhere). The page still shows it.
export async function deleteCardElsewhere(page: Page, id: string): Promise<void> {
  const status = await page.evaluate(async (cardId) => {
    const response = await fetch(`/api/lcards/${cardId}`, { method: "DELETE" });
    return response.status;
  }, id);
  expect(status, "the delete from inside the page").toBe(204);
}

// Replaces a card's title and description the way another client would,
// with requests from inside the page. In the mock mode the page's fake
// backend answers them, so this is the only way to reach its state. A copy
// the page holds no longer matches the card.
export async function changeCardElsewhere(page: Page, id: string): Promise<void> {
  const status = await page.evaluate(async (cardId) => {
    const response = await fetch(`/api/lcards/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Changed elsewhere",
        description: "Changed in another tab.",
      }),
    });
    return response.status;
  }, id);
  expect(status, "the change from inside the page").toBe(204);
}

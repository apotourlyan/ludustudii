// Steps on learning cards shared by the app and end-to-end tests.

import { expect, type Locator, type Page } from "@playwright/test";

// The text of the not-found page for a card.
export const NOT_FOUND_TEXT = "This card doesn't exist. It may have been deleted.";

// The card ID in a card's editor path, /library/cards/<id>.
export function cardIdFromPath(path: string | null | undefined): string {
  const id = path?.match(/^\/library\/cards\/([^/]+)$/)?.[1];
  if (!id) {
    throw new Error(`not a card's editor path: ${JSON.stringify(path)}`);
  }
  return id;
}

// The ID of the card a slide shows, from its "Update" link.
export async function cardIdOf(slide: Locator): Promise<string> {
  return cardIdFromPath(await slide.getByRole("link", { name: "Update" }).getAttribute("href"));
}

// Deletes the card a slide shows through its confirmation dialog, and
// returns the dialog, which closes once the card is deleted and stays open
// with the error otherwise.
export async function deleteFromSlide(page: Page, slide: Locator): Promise<Locator> {
  await slide.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this learning card?" });
  await dialog.getByRole("button", { name: "Delete" }).click();
  return dialog;
}

// Replaces a card's title and description the way another client would,
// with requests from inside the page. In the mock mode the page's fake
// backend answers them, so this is the only way to reach its state. The
// card's version goes up, so a copy the page holds is now stale.
export async function changeCardElsewhere(page: Page, id: string): Promise<void> {
  const status = await page.evaluate(async (cardId) => {
    const url = `/api/lcards/${cardId}`;
    const current = await fetch(url);
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "If-Match": current.headers.get("ETag") ?? "",
      },
      body: JSON.stringify({
        title: "Changed elsewhere",
        description: "Changed in another tab.",
      }),
    });
    return response.status;
  }, id);
  expect(status, "the change from inside the page").toBe(204);
}

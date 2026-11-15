// Steps on learning cards shared by the app and end-to-end tests.

import { expect, type Locator, type Page } from "@playwright/test";

// The ID of the card a slide shows, from its "Update" link.
export async function cardIdOf(slide: Locator): Promise<string> {
  const href = await slide.getByRole("link", { name: "Update" }).getAttribute("href");
  const id = href?.match(/^\/learning-card\/([^/]+)$/)?.[1];
  if (!id) {
    throw new Error(`the slide's Update link has no card ID: ${JSON.stringify(href)}`);
  }
  return id;
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

// The cards overview, /library/cards, in either of its views: a list named
// "Learning cards", newest first, whose items each show a card's title and
// its actions. Only the items near the window are rendered, and each says
// its place among all the cards with aria-posinset and aria-setsize.

import { expect, type Locator, type Page } from "@playwright/test";

// The overview's views, as its URL names them.
export const VIEWS = ["list", "grid"] as const;
export type View = (typeof VIEWS)[number];

// The list of cards, in whichever view the page shows.
export function cardList(page: Page): Locator {
  return page.getByRole("list", { name: "Learning cards" });
}

// The items the overview has rendered, in order.
export function cardItems(page: Page): Locator {
  return cardList(page).getByRole("listitem");
}

// The item at this position among all the cards, counted from 1, newest
// first, once it is rendered.
export function cardAt(page: Page, position: number): Locator {
  return cardItems(page).and(page.locator(`[aria-posinset="${position}"]`));
}

// The item that shows the card with this exact title, once it is rendered.
export function cardItem(page: Page, title: string): Locator {
  return cardItems(page).filter({ has: page.getByText(title, { exact: true }) });
}

// Scrolls the window by `y` pixels, or to the bottom with "bottom", and
// waits two frames, so the virtualizer has rendered the items now in view.
export async function scrollWindow(page: Page, y: number | "bottom"): Promise<void> {
  await page.evaluate(async (by) => {
    window.scrollBy(0, by === "bottom" ? document.documentElement.scrollHeight : by);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, y);
}

// Scrolls down from where the window is, a screen at a time, until the
// card with this exact title is rendered, and returns its item. Fails at
// the bottom. For lists that other tests change at the same time, where a
// card's position isn't known, only its title.
export async function findCard(page: Page, title: string): Promise<Locator> {
  const item = cardItem(page, title);
  await expect(cardItems(page).first()).toBeVisible();
  for (;;) {
    if ((await item.count()) > 0) {
      await item.scrollIntoViewIfNeeded();
      return item;
    }
    const before = await page.evaluate(() => window.scrollY);
    await scrollWindow(page, await page.evaluate(() => window.innerHeight));
    if ((await page.evaluate(() => window.scrollY)) === before) {
      throw new Error(`no item shows a card titled ${JSON.stringify(title)}`);
    }
  }
}

// Checks that the item at this position shows the card with this title,
// and that the overview counts `total` cards.
export async function expectCardAt(
  page: Page,
  position: number,
  title: string,
  total: number,
): Promise<void> {
  const item = cardAt(page, position);
  await expect(item.getByText(title, { exact: true })).toBeVisible();
  await expect(item).toHaveAttribute("aria-setsize", String(total));
}

declare global {
  interface Window {
    // Set by watchListRequests.
    listRequestsWatch?: { count: number; fail: boolean };
  }
}

// Counts the requests for the list of cards (GET /api/lcards) from inside
// the page, and fails them as a network failure would once
// failListRequests is called. The mock mode's fake backend answers
// requests in a service worker, before Playwright's routing sees them, so
// this wraps the page's fetch in an init script, before the app's API
// client takes it. Call it before page.goto.
export async function watchListRequests(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { count: 0, fail: false };
    window.listRequestsWatch = state;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (method.toUpperCase() === "GET" && url.pathname === "/api/lcards") {
        state.count += 1;
        if (state.fail) return Promise.reject(new TypeError("Failed to fetch"));
      }
      return original(input, init);
    };
  });
}

// Fails every later list request; see watchListRequests.
export async function failListRequests(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.listRequestsWatch!.fail = true;
  });
}

// How many list requests the page has made; see watchListRequests.
export async function listRequestCount(page: Page): Promise<number> {
  return page.evaluate(() => window.listRequestsWatch!.count);
}

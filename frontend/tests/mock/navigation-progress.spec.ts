// The bar at the top of the viewport while a navigation loads (ADR 0041):
// after a short delay, so a fast navigation doesn't flicker it, and still
// for users who prefer reduced motion. Hidden from assistive technology, so
// it's found by its data-slot.

import { expect, test, type Locator, type Page } from "@playwright/test";

import { holdRequests, releaseRequests } from "../support/fetch";
import { cardAt, cardItems } from "../support/overview";

function progressBar(page: Page): Locator {
  return page.locator("[data-slot=navigation-progress]");
}

// The number of animations running in the bar and its segment.
function animations(bar: Locator): Promise<number> {
  return bar.evaluate((element) => element.getAnimations({ subtree: true }).length);
}

// Opens the newest card's page from the list, holding the card's request
// until releaseRequests, and checks the bar while the page loads.
async function openCardSlowly(page: Page): Promise<Locator> {
  await holdRequests(page, "GET", /^\/api\/lcards\/[^/]+$/);
  await page.goto("/library/cards");
  await expect(cardItems(page)).toHaveCount(8);
  await expect(progressBar(page)).toHaveCount(0);

  await cardAt(page, 1).getByRole("link", { name: "Open" }).click();

  const bar = progressBar(page);
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("aria-hidden", "true");
  return bar;
}

test("a slow navigation shows the bar until the page shows", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const bar = await openCardSlowly(page);

  expect(await animations(bar)).toBeGreaterThan(0);

  await releaseRequests(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
  await expect(bar).toHaveCount(0);
});

test("under reduced motion, the bar doesn't move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const bar = await openCardSlowly(page);

  expect(await animations(bar)).toBe(0);

  await releaseRequests(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
  await expect(bar).toHaveCount(0);
});

test("a fast navigation never shows the bar", async ({ page }) => {
  // Records whether the bar was ever added, however briefly.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector("[data-slot=navigation-progress]")) {
        window.navigationProgressShown = true;
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/library/cards");
  // A first visit to a card's page loads its code, which can be slow on a
  // dev server; the measured navigation below needs only its card.
  await cardAt(page, 2).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("日本語: は vs. が");
  await page.goBack();
  await expect(cardItems(page)).toHaveCount(8);
  await page.evaluate(() => {
    window.navigationProgressShown = false;
  });

  await cardAt(page, 1).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");

  expect(await page.evaluate(() => window.navigationProgressShown)).toBe(false);
});

declare global {
  interface Window {
    navigationProgressShown?: boolean;
  }
}

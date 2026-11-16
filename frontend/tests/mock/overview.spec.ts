// Each of the cards overview's views: rendered only near the window, with
// every item's place among all the cards, long titles cut, the actions,
// and Back returning to where the page was scrolled. The "many" scenario
// has 150 cards; the overview loads the first page of 100.

import { expect, test, type Page } from "@playwright/test";

import { deleteCard, openCardFromList } from "../support/cards";
import {
  cardAt,
  cardItem,
  cardItems,
  cardList,
  expectCardAt,
  scrollWindow,
  VIEWS,
  type View,
} from "../support/overview";

const MANY_TOTAL = 150;
const LOADED = 100;

// The "many" scenario's title of the card at this position, newest first.
function manyTitle(position: number): string {
  return `Card ${MANY_TOTAL + 1 - position} of ${MANY_TOTAL}`;
}

async function openOverview(page: Page, view: View, scenario = "default"): Promise<void> {
  await page.goto(`/library/cards?scenario=${scenario}&view=${view}`);
  await expect(cardItems(page).first()).toBeVisible();
}

// Each rendered item's position and set size, and the title its position
// says it should show.
async function expectPositions(page: Page): Promise<void> {
  const items = cardItems(page);
  const count = await items.count();
  for (let index = 0; index < count; index++) {
    const item = items.nth(index);
    await expect(item).toHaveAttribute("aria-setsize", String(LOADED));
    const position = Number(await item.getAttribute("aria-posinset"));
    await expect(item.getByText(manyTitle(position), { exact: true })).toBeVisible();
  }
}

// The name of the switch's button for this view.
function viewButtonName(view: View): string {
  return view === "list" ? "List view" : "Grid view";
}

// The title element an item shows, the one that cuts its text.
function titleOf(page: Page, title: string) {
  return cardItem(page, title).locator("[data-slot=card-title]");
}

// Long enough to need more than three lines anywhere the overview shows
// it, and within the 200 characters a title may have.
const LONG_TITLE = `The **long** title ${"that goes on and on ".repeat(7)}until it is cut`;

for (const view of VIEWS) {
  test.describe(`the ${view} view`, () => {
    test("renders far fewer items than cards, each with its place among all", async ({ page }) => {
      await openOverview(page, view, "many");

      await expect(cardList(page)).toBeVisible();
      await expectCardAt(page, 1, manyTitle(1), LOADED);
      const rendered = await cardItems(page).count();
      expect(rendered, "items in the DOM").toBeLessThanOrEqual(LOADED / 2);
      await expectPositions(page);
    });

    test("scrolling to the bottom shows the last card", async ({ page }) => {
      await openOverview(page, view, "many");

      await scrollWindow(page, "bottom");

      const last = cardAt(page, LOADED);
      await expect(last).toBeInViewport();
      await expect(last.getByText(manyTitle(LOADED), { exact: true })).toBeVisible();
      await expect(cardAt(page, 1)).toHaveCount(0);
      expect(await cardItems(page).count(), "items in the DOM").toBeLessThanOrEqual(LOADED / 2);
      await expectPositions(page);
    });

    test("tabbing through the actions keeps going past the first screen", async ({ page }) => {
      await openOverview(page, view, "many");
      const target = 30;

      await cardAt(page, 1).getByRole("link", { name: "Open" }).focus();
      // Open, Update and Delete on each card before the target.
      for (let step = 0; step < (target - 1) * 3; step++) {
        await page.keyboard.press("Tab");
      }

      const open = cardAt(page, target).getByRole("link", { name: "Open" });
      await expect(open).toBeFocused();
      await expect(open).toBeInViewport();
    });

    test("Open, Update and Delete work from it", async ({ page }) => {
      await openOverview(page, view);

      await openCardFromList(page, cardAt(page, 1));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
      await page.goBack();

      await cardAt(page, 2).getByRole("link", { name: "Update" }).click();
      await expect(page.getByLabel("Title")).toHaveValue("日本語: は vs. が");
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`[?&]view=${view}$`));

      const dialog = await deleteCard(page, cardAt(page, 1));
      await expect(dialog).toBeHidden();
      await expect(cardItem(page, "Mitochondria")).toHaveCount(0);
      await expectCardAt(page, 1, "日本語: は vs. が", 7);
      await expect(cardItems(page)).toHaveCount(7);
    });

    test("Back from a card far down returns to it", async ({ page }) => {
      await openOverview(page, view, "many");
      await scrollWindow(page, 4000);
      // An item in the middle of the window.
      const title = await page.evaluate(() => {
        const element = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        return element?.closest("li")?.querySelector("[data-slot=card-title]")?.textContent;
      });
      expect(title).toMatch(/^Card \d+ of 150$/);

      await openCardFromList(page, cardItem(page, title!));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title!);
      await page.goBack();

      await expect(page).toHaveURL(new RegExp(`[?&]view=${view}$`));
      await expect(cardItem(page, title!)).toBeInViewport();
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(3000);
    });

    test("a long title is cut with an ellipsis", async ({ page }) => {
      await page.goto(`/library/cards/new`);
      await page.getByLabel("Title").fill(LONG_TITLE);
      await page.getByLabel("Description").fill("Long.");
      await page.getByRole("button", { name: "Create Card" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText("The long title");
      await page.getByRole("link", { name: "Learning Cards", exact: true }).click();
      await page.getByRole("button", { name: viewButtonName(view) }).click();

      const rendered = LONG_TITLE.replace(/\*\*/g, "");
      const title = titleOf(page, rendered);
      await expect(title).toBeVisible();
      const box = await title.evaluate((element) => ({
        lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      const lines = view === "list" ? 1 : 3;
      expect(Math.round(box.clientHeight / box.lineHeight), "lines shown").toBe(lines);
      if (view === "list") {
        expect(box.scrollWidth, "content width").toBeGreaterThan(box.clientWidth);
      } else {
        expect(box.scrollHeight, "content height").toBeGreaterThan(box.clientHeight);
      }
    });
  });
}

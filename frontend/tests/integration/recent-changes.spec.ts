// The overview marks a card created in the last five minutes as new and
// one updated in them as updated (ADR 0040), in both views, and drops the
// marks when the five minutes are over, without a reload; and where a mark
// sits. The tests run on Playwright's clock, which the page and its fake
// backend share. What a mark shows, for which cards, is checked by
// recent-change.test.ts, recent-change-mark.test.tsx and
// learning-cards-overview.test.tsx.

import { expect, test, type Locator, type Page } from "@playwright/test";

import { cardItem, cardItems, VIEWS, type View } from "../support/overview";
import {
  createCardThroughUi,
  editCardThroughUi,
  expectMark,
  expectNoMark,
  markIcon,
} from "../support/recent-changes";

const NEW_TITLE = "A card made just now";
// A seeded card, made a day ago.
const EDITED_TITLE = "Mitochondria";

// Shows the overview in this view, from wherever on it the page is.
async function showView(page: Page, view: View): Promise<void> {
  await page.getByRole("button", { name: view === "list" ? "List view" : "Grid view" }).click();
  await expect(page).toHaveURL(new RegExp(`view=${view}$`));
}

// Creates a card and edits a seeded one, through the UI, and ends on the
// overview's list.
async function createAndEdit(page: Page, newTitle = NEW_TITLE): Promise<void> {
  await page.goto("/library/cards");
  await expect(cardItems(page).first()).toBeVisible();
  await createCardThroughUi(page, newTitle);
  await editCardThroughUi(page, cardItem(page, EDITED_TITLE), EDITED_TITLE);
  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test("a created card is new and an edited one updated, in both views, until five minutes pass", async ({
  page,
}) => {
  await createAndEdit(page);
  // Set on the page's window, so it is gone if the page reloads.
  await page.evaluate(() => Object.assign(window, { notReloaded: true }));

  for (const view of VIEWS) {
    await showView(page, view);
    await expectMark(cardItem(page, NEW_TITLE), "New", NEW_TITLE);
    await expectMark(cardItem(page, EDITED_TITLE), "Updated", EDITED_TITLE);
    // Only those two.
    await expect(markIcon(cardItems(page))).toHaveCount(2);
  }

  // Past the five minutes, the next tick of the page's clock drops both
  // marks.
  await page.clock.fastForward("05:01");
  await expect(markIcon(cardItems(page))).toHaveCount(0);
  await expectNoMark(cardItem(page, NEW_TITLE));
  await expectNoMark(cardItem(page, EDITED_TITLE));
  await showView(page, "list");
  await expect(markIcon(cardItems(page))).toHaveCount(0);
  expect(await page.evaluate(() => "notReloaded" in window), "the same page").toBe(true);
});

test("in the list, titles start at the same x with or without a mark", async ({ page }) => {
  await createAndEdit(page);

  const titleX = async (title: string) => {
    const box = await cardItem(page, title).locator("[data-slot=card-title]").boundingBox();
    return box!.x;
  };
  const unmarked = await titleX("Binary search");
  expect(await titleX(NEW_TITLE)).toBe(unmarked);
  expect(await titleX(EDITED_TITLE)).toBe(unmarked);
  // The marks lead the titles.
  const iconBox = await markIcon(cardItem(page, NEW_TITLE)).boundingBox();
  expect(iconBox!.x + iconBox!.width).toBeLessThan(unmarked);
});

// Long enough for more than three lines in a grid card at any width.
const LONG_TITLE = `A long title ${"that wraps on and on ".repeat(8)}to the end`;

// The right edge of the text an element shows, over all its lines.
function textRight(element: Locator): Promise<number> {
  return element.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return Math.max(...[...range.getClientRects()].map((rect) => rect.right));
  });
}

// The width of an element's content box.
function contentWidth(element: Locator): Promise<number> {
  return element.evaluate((node) => {
    const style = getComputedStyle(node);
    return node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  });
}

for (const width of [1280, 390]) {
  test(`in the grid at ${width}px, a long title stops left of the mark, and unmarked titles wrap the same`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await createAndEdit(page, LONG_TITLE);
    await showView(page, "grid");

    const created = cardItems(page).first();
    const title = created.locator("[data-slot=card-title]");
    await expect(markIcon(created)).toBeVisible();
    // The title fills its three lines, so it reaches the right edge.
    const lineHeight = await title.evaluate((node) =>
      parseFloat(getComputedStyle(node).lineHeight),
    );
    expect((await title.boundingBox())!.height).toBeCloseTo(3 * lineHeight, 0);

    const icon = (await markIcon(created).boundingBox())!;
    expect(await textRight(title)).toBeLessThanOrEqual(icon.x);
    // The icon sits in the top right corner, on the title's first line.
    const titleBox = (await title.boundingBox())!;
    expect(icon.y).toBeGreaterThanOrEqual(titleBox.y);
    expect(icon.y + icon.height).toBeLessThanOrEqual(titleBox.y + lineHeight);

    const unmarked = cardItem(page, "Binary search").locator("[data-slot=card-title]");
    expect(await contentWidth(unmarked)).toBe(await contentWidth(title));
  });
}

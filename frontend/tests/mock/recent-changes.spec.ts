// The overview marks a card created in the last five minutes as new and
// one updated in them as updated (ADR 0040), in both views, and drops the
// marks when the five minutes are over, without a reload. Seeded cards are
// a day old, so a fresh session marks none. The tests run on Playwright's
// clock, which the page and its fake backend share.

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

test("seeded cards have no mark, in either view", async ({ page }) => {
  await page.goto("/library/cards");
  await expect(cardItems(page)).toHaveCount(8);

  for (const view of VIEWS) {
    await showView(page, view);
    await expect(cardItems(page)).toHaveCount(8);
    await expect(markIcon(cardItems(page))).toHaveCount(0);
    for (const item of await cardItems(page).all()) await expectNoMark(item);
  }
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

test("a card created and then edited within the five minutes is new", async ({ page }) => {
  await page.goto("/library/cards");
  await expect(cardItems(page).first()).toBeVisible();
  await createCardThroughUi(page, NEW_TITLE);
  await page.clock.fastForward("02:00");
  await editCardThroughUi(page, cardItem(page, NEW_TITLE), NEW_TITLE);

  await expectMark(cardItem(page, NEW_TITLE), "New", NEW_TITLE);
});

// The colors of the icon and of the card behind it, as sRGB, read by
// painting each computed color on a canvas, whatever syntax it is in.
async function iconAndCardColors(item: Locator): Promise<{ icon: number[]; card: number[] }> {
  return markIcon(item).evaluate((icon) => {
    const card = icon.closest("[data-slot=card]")!;
    const context = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    const rgb = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    return {
      icon: rgb(getComputedStyle(icon).color),
      card: rgb(getComputedStyle(card).backgroundColor),
    };
  });
}

// WCAG's relative luminance of an sRGB color.
function luminance(rgb: number[]): number {
  const [red, green, blue] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

// WCAG's contrast ratio between two sRGB colors.
function contrast(a: number[], b: number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

// The drawing of an item's mark icon.
function iconShape(item: Locator): Promise<string> {
  return markIcon(item).evaluate((icon) => icon.innerHTML);
}

test("the two marks differ in icon and color, each at least 3:1 against the card", async ({
  page,
}) => {
  await createAndEdit(page);

  for (const view of VIEWS) {
    await showView(page, view);
    const created = cardItem(page, NEW_TITLE);
    const edited = cardItem(page, EDITED_TITLE);

    expect(await iconShape(created), "the icons' drawings").not.toBe(await iconShape(edited));

    const newColors = await iconAndCardColors(created);
    const updatedColors = await iconAndCardColors(edited);
    expect(newColors.icon, "the icons' colors").not.toEqual(updatedColors.icon);
    expect(contrast(newColors.icon, newColors.card), "new").toBeGreaterThanOrEqual(3);
    expect(contrast(updatedColors.icon, updatedColors.card), "updated").toBeGreaterThanOrEqual(3);
  }
});

test("the icons aren't framed or interactive", async ({ page }) => {
  await createAndEdit(page);

  for (const view of VIEWS) {
    await showView(page, view);
    for (const title of [NEW_TITLE, EDITED_TITLE]) {
      const icon = markIcon(cardItem(page, title));
      const style = await icon.evaluate((element) => {
        const own = getComputedStyle(element);
        const parent = getComputedStyle(element.parentElement!);
        return {
          cursor: own.cursor,
          border: [own.borderWidth, parent.borderWidth],
          background: [own.backgroundColor, parent.backgroundColor],
          interactive: element.closest("a, button, [role=button], [tabindex]") !== null,
        };
      });
      expect(style, title).toEqual({
        cursor: "auto",
        border: ["0px", "0px"],
        background: ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"],
        interactive: false,
      });
    }
  }
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

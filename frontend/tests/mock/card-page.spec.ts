// A card's own page, /library/cards/<id>: the card with its title as the
// page's heading, its actions, and a link to a new card above it.
// The fake's state lives in the page, so each test reaches a card through
// the list's links: page.goto would load a fresh fake.

import { expect, test, type Locator, type Page } from "@playwright/test";

import { openCardFromList } from "../support/cards";
import { currentSlide } from "../support/carousel";

// Opens the newest card, "Mitochondria", on its page, and returns its ID.
async function openNewestCard(page: Page): Promise<string> {
  await page.goto("/library/cards");
  const id = await openCardFromList(page, currentSlide(page));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
  return id;
}

// The card on its page. A frame has no role or name of its own, so it is
// found as the card element around the page's heading.
function cardOnPage(page: Page): Locator {
  return page.getByRole("heading", { level: 1 }).locator("xpath=ancestor::*[@data-slot='card'][1]");
}

test("Open in the list shows the card on its own page", async ({ page }) => {
  const id = await openNewestCard(page);

  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  const card = cardOnPage(page);
  await expect(card.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
  await expect(
    card.getByText("The site of aerobic respiration; produces most of the cell’s ATP."),
  ).toBeVisible();
  await expect(card.getByRole("link", { name: "Update" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Delete" })).toBeVisible();
  await expect(card.getByRole("link", { name: "Open" })).toHaveCount(0);

  // The page has no link back of its own; the navigation's leads to the list.
  await page.getByRole("link", { name: "Learning Cards", exact: true }).click();
  await expect(page).toHaveURL(/\/library\/cards$/);
  await expect(page.getByRole("status")).toHaveText("1 / 8");
});

test("the card's page links to a new card", async ({ page }) => {
  await openNewestCard(page);

  // The root layout's navigation has a link of the same name; the page's
  // own is in main.
  await page.getByRole("main").getByRole("link", { name: "Add Card" }).click();
  await expect(page).toHaveURL(/\/library\/cards\/new$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add Card");
});

test("Update on the card's page opens its editor", async ({ page }) => {
  const id = await openNewestCard(page);

  await cardOnPage(page).getByRole("link", { name: "Update" }).click();
  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}/edit$`));
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondria");
});

test.describe("at 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("opening the editor doesn't move the card", async ({ page }) => {
    await openNewestCard(page);
    const card = await cardOnPage(page).boundingBox();

    await cardOnPage(page).getByRole("link", { name: "Update" }).click();
    const preview = page.getByRole("region", { name: "Preview" });
    await expect(preview).toBeVisible();
    const previewBox = await preview.boundingBox();

    expect(card).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(Math.abs(card!.x - previewBox!.x), "left edge").toBeLessThanOrEqual(1);
    expect(Math.abs(card!.y - previewBox!.y), "top edge").toBeLessThanOrEqual(1);
    expect(Math.abs(card!.width - previewBox!.width), "width").toBeLessThanOrEqual(1);
  });

  test("Add Card is above the card at its right edge, the title level with the buttons", async ({
    page,
  }) => {
    await openNewestCard(page);
    const card = (await cardOnPage(page).boundingBox())!;
    const addCard = (await page
      .getByRole("main")
      .getByRole("link", { name: "Add Card" })
      .boundingBox())!;
    expect(addCard.y + addCard.height).toBeLessThanOrEqual(card.y);
    expect(
      Math.abs(addCard.x + addCard.width - (card.x + card.width)),
      "right edges",
    ).toBeLessThanOrEqual(1);

    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const update = (await cardOnPage(page).getByRole("link", { name: "Update" }).boundingBox())!;
    expect(
      Math.abs(title.y + title.height / 2 - (update.y + update.height / 2)),
      "vertical centers",
    ).toBeLessThanOrEqual(1);
  });
});

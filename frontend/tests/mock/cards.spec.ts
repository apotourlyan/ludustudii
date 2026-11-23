// Creating, editing and deleting cards through the UI, against the fake
// backend, and where each ends: creating and editing on the card's page,
// deleting on the list. The fake's state lives in the page, so each test
// moves between pages with the app's links: page.goto would load a fresh
// fake. Back is the browser's, which keeps the page and its fake.

import { expect, test, type Page } from "@playwright/test";

import {
  cardIdOf,
  deleteCard,
  deleteCardElsewhere,
  NOT_FOUND_TEXT,
  openCardFromList,
} from "../support/cards";
import { cardAt, cardItems, expectCardAt } from "../support/overview";
import { toast, toasts } from "../support/toasts";

// The list's own "Add Card" link, not the navigation's.
async function addCardFromList(page: Page): Promise<void> {
  await page.goto("/library/cards");
  await expect(cardItems(page)).toHaveCount(8);
  await page.getByRole("main").getByRole("link", { name: "Add Card" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add Card");
}

// Shows the overview through the navigation, with the 7 cards left after
// one of the 8 is deleted.
async function showOverview(page: Page): Promise<void> {
  await page.getByRole("navigation").getByRole("link", { name: "Learning Cards" }).click();
  await expectCardAt(page, 1, "日本語: は vs. が", 7);
}

// Opens the newest card, "Mitochondria", on its page, and returns its ID.
async function openNewestCard(page: Page): Promise<string> {
  await page.goto("/library/cards");
  const id = await openCardFromList(page, cardAt(page, 1));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
  return id;
}

test("a created card opens on its page, and Back returns to the list", async ({ page }) => {
  await addCardFromList(page);

  await page.getByLabel("Title").fill("Krebs cycle");
  await page.getByLabel("Description").fill("Happens in the **mitochondrial matrix**.");
  await page.getByRole("button", { name: "Create Card" }).click();

  await expect(page).toHaveURL(/\/library\/cards\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Krebs cycle");
  await expect(page.getByRole("main").getByRole("strong")).toHaveText("mitochondrial matrix");

  // The card's page replaced the form in the history.
  await page.goBack();
  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
  await expectCardAt(page, 1, "Krebs cycle", 9);
});

test("an edited card shows its changes on its page", async ({ page }) => {
  const id = await openNewestCard(page);
  await page.getByRole("main").getByRole("link", { name: "Update" }).click();

  const title = page.getByLabel("Title");
  await expect(title).toHaveValue("Mitochondria");
  await title.fill("Mitochondrion");
  await page.getByLabel("Description").fill("The *powerhouse* of the cell.");
  await page.getByRole("button", { name: "Update Card" }).click();

  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondrion");
  await expect(page.getByRole("main").getByRole("emphasis")).toHaveText("powerhouse");

  await page.getByRole("link", { name: "Learning Cards", exact: true }).click();
  await expectCardAt(page, 1, "Mitochondrion", 8);
});

test("a card deleted on its page leaves the list, and Back doesn't return to it", async ({
  page,
}) => {
  await openNewestCard(page);

  const dialog = await deleteCard(page, page.getByRole("main"));

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
  await expectCardAt(page, 1, "日本語: は vs. が", 7);
  await expect(page.getByText("Mitochondria", { exact: true })).toHaveCount(0);

  // The list replaced the card's page in the history, so Back goes to the
  // entry before it: the list the card was opened from.
  await page.goBack();
  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
  await expectCardAt(page, 1, "日本語: は vs. が", 7);
  await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toHaveCount(0);
});

// The delete removes the card's cached copy while its page is still on
// screen, waiting for the list to load. A re-render then would fetch the
// deleted card and fail; the delay makes that wait long.
test("a card deleted on its page isn't fetched again while the list loads", async ({ page }) => {
  await page.goto("/library/cards?delay=800");
  const id = await openCardFromList(page, cardAt(page, 1));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
  const fetched: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && new URL(request.url()).pathname === `/api/lcards/${id}`) {
      fetched.push(request.url());
    }
  });

  await deleteCard(page, page.getByRole("main"));

  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
  await expectCardAt(page, 1, "日本語: は vs. が", 7);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(fetched).toEqual([]);
});

test("a card deleted in the list leaves it", async ({ page }) => {
  await page.goto("/library/cards");
  await expectCardAt(page, 1, "Mitochondria", 8);

  const dialog = await deleteCard(page, cardAt(page, 1));

  await expect(dialog).toBeHidden();
  await expectCardAt(page, 1, "日本語: は vs. が", 7);
  await expect(cardItems(page)).toHaveCount(7);
  await expect(page.getByText("Mitochondria", { exact: true })).toHaveCount(0);
  await expect(toasts(page)).toHaveCount(0);
});

// A card deleted elsewhere answers a write with 404. The error shows as a
// toast, and the list fetches again, so it stops showing the card.

test("deleting a card deleted elsewhere in the list removes it from the list", async ({ page }) => {
  await page.goto("/library/cards");
  await expectCardAt(page, 1, "Mitochondria", 8);
  await deleteCardElsewhere(page, await cardIdOf(cardAt(page, 1)));

  const dialog = await deleteCard(page, cardAt(page, 1));

  await expect(dialog).toBeHidden();
  await expect(toast(page, NOT_FOUND_TEXT)).toBeVisible();
  await expectCardAt(page, 1, "日本語: は vs. が", 7);
  await expect(page.getByText("Mitochondria", { exact: true })).toHaveCount(0);
});

test("deleting a card deleted elsewhere on its page shows the error", async ({ page }) => {
  const id = await openNewestCard(page);
  await deleteCardElsewhere(page, id);

  const dialog = await deleteCard(page, page.getByRole("main"));

  await expect(dialog).toBeHidden();
  await expect(toast(page, NOT_FOUND_TEXT)).toBeVisible();
  await showOverview(page);
  await expect(page.getByText("Mitochondria", { exact: true })).toHaveCount(0);
});

test("saving a card deleted elsewhere keeps the input and shows the error", async ({ page }) => {
  const id = await openNewestCard(page);
  await page.getByRole("main").getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondria");
  await deleteCardElsewhere(page, id);

  await page.getByLabel("Title").fill("Mitochondrion");
  await page.getByRole("button", { name: "Update Card" }).click();

  await expect(toast(page, NOT_FOUND_TEXT)).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondrion");
  await showOverview(page);
  await expect(page.getByText("Mitochondria", { exact: true })).toHaveCount(0);
});

test("Cancel on the edit page returns to the card's page, unchanged", async ({ page }) => {
  const id = await openNewestCard(page);
  await page.getByRole("main").getByRole("link", { name: "Update" }).click();
  await page.getByLabel("Title").fill("Not saved");

  await page.getByRole("link", { name: "Cancel" }).click();

  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
});

test("Cancel on the new card page returns to the list, with nothing added", async ({ page }) => {
  await addCardFromList(page);
  await page.getByLabel("Title").fill("Not saved");

  await page.getByRole("link", { name: "Cancel" }).click();

  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
  await expect(cardItems(page)).toHaveCount(8);
  await expect(page.getByText("Not saved", { exact: true })).toHaveCount(0);
});

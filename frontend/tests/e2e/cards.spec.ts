// The built server with the client app embedded, on a real database
// (ADR 0034). Tests run in parallel on one database, so each creates its
// own uniquely titled card and asserts only on it, never on totals or
// positions: the list is newest first, and another test may add a card at
// any moment, so a card is found by its title or opened by its ID.

import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { cardIdFromPath, cardIdOf, deleteCard, NOT_FOUND_TEXT } from "../support/cards";
import { findCard } from "../support/overview";
import {
  createCardThroughUi,
  editCardThroughUi,
  expectMark,
  RECENT_CHANGE_WINDOW_MS,
} from "../support/recent-changes";

// A title no other test or run uses.
function uniqueTitle(label: string): string {
  return `${label} ${randomUUID()}`;
}

test("a card is created, edited and deleted through the UI", async ({ page }) => {
  const title = uniqueTitle("Lifecycle");
  const edited = `${title} (edited)`;

  await page.goto("/library/cards/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Created by an **end-to-end** test.");
  await page.getByRole("button", { name: "Create card" }).click();

  // Creating ends on the card's page, once the server has saved it.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const id = cardIdFromPath(new URL(page.url()).pathname);
  await expect(page.getByRole("main").getByRole("strong")).toHaveText("end-to-end");

  await page.getByRole("link", { name: "Learning cards", exact: true }).click();
  const item = await findCard(page, title);
  await item.getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await page.getByLabel("Title").fill(edited);
  await page.getByRole("button", { name: "Update card" }).click();

  // Editing ends on the card's page too, with the change.
  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(edited);

  // The grid shows the change too, and opens the card's page.
  await page.getByRole("link", { name: "Learning cards", exact: true }).click();
  await page.getByRole("button", { name: "Grid view" }).click();
  await expect(page).toHaveURL(/\/library\/cards\?view=grid$/);
  const card = await findCard(page, edited);
  await card.getByRole("link", { name: "Open" }).click();
  await expect(page).toHaveURL(new RegExp(`/library/cards/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(edited);

  // Deleting on the card's page ends on the list, without the card.
  const dialog = await deleteCard(page, page.getByRole("main"));
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
  await expect(page.getByRole("heading", { name: "Learning cards", level: 1 })).toBeVisible();
  await expect(page.getByText(edited, { exact: true })).toHaveCount(0);

  // Gone from the server too, not only from the page's list.
  await page.goto(`/library/cards/${id}`);
  await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toBeVisible();
});

test("a card's URL opens its page, and its editor's URL the form", async ({ page, request }) => {
  const title = uniqueTitle("Direct");
  const description = "Opened by its URL.";
  const created = await request.post("/api/lcards", { data: { title, description } });
  expect(created.status()).toBe(201);
  const location = created.headers()["location"] ?? "";
  const id = location.match(/^\/api\/lcards\/([^/]+)$/)?.[1];
  expect(id, `the Location header ${JSON.stringify(location)}`).toBeTruthy();

  await page.goto(`/library/cards/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByText(description, { exact: true })).toBeVisible();

  await page.goto(`/library/cards/${id}/edit`);
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await expect(page.getByLabel("Description")).toHaveValue(description);
  await expect(page.getByRole("button", { name: "Update card" })).toBeEnabled();

  // Keeps the list short for the other tests; the database goes when the
  // run ends either way.
  const deleted = await request.delete(location);
  expect(deleted.status()).toBe(204);
});

// A card response's timestamps, in milliseconds since the epoch.
function cardTimes(body: unknown): { createdAt: number; updatedAt: number } {
  if (
    typeof body !== "object" ||
    body === null ||
    !("created_at" in body) ||
    !("updated_at" in body) ||
    typeof body.created_at !== "string" ||
    typeof body.updated_at !== "string"
  ) {
    throw new Error(`not a card with timestamps: ${JSON.stringify(body)}`);
  }
  return { createdAt: Date.parse(body.created_at), updatedAt: Date.parse(body.updated_at) };
}

// The overview marks cards by the server's timestamps, compared with the
// browser's clock (ADR 0040). A card created and then edited within five
// minutes stays new; to see the updated mark without waiting, the page's
// clock is then set between the two: more than five minutes after the card
// was created, and less than five after it was updated.
test("the overview marks a card created and edited through the UI", async ({ page, request }) => {
  const title = uniqueTitle("Marked");

  await page.goto("/library/cards");
  await createCardThroughUi(page, title);
  const created = await findCard(page, title);
  await expectMark(created, "New", title);
  const id = await cardIdOf(created);

  await editCardThroughUi(page, created, title);
  await expectMark(await findCard(page, title), "New", title);

  const response = await request.get(`/api/lcards/${id}`);
  expect(response.status()).toBe(200);
  const { createdAt, updatedAt } = cardTimes(await response.json());
  expect(updatedAt, "updated_at after the edit").toBeGreaterThan(createdAt);

  await page.clock.setFixedTime(createdAt + RECENT_CHANGE_WINDOW_MS + (updatedAt - createdAt) / 2);
  await page.reload();
  await expectMark(await findCard(page, title), "Updated", title);

  const deleted = await request.delete(`/api/lcards/${id}`);
  expect(deleted.status()).toBe(204);
});

test("a nonexistent card ID shows the not-found page", async ({ page }) => {
  // A valid UUIDv7 that the database never generates: its time is 1970.
  await page.goto("/library/cards/00000000-0000-7000-8000-000000000000");

  await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to learning cards" }).click();
  await expect(page.getByRole("heading", { name: "Learning cards", level: 1 })).toBeVisible();
});

// JavaScript's trim() keeps U+0085 where Go's strings.TrimSpace strips it,
// so the form accepts a title of only that character and the API rejects it
// (ADR 0038). The API's verdict lands on the title field.
test("the API's required error for a title the form accepted shows on the title", async ({
  page,
}) => {
  await page.goto("/library/cards/new");
  await page.getByLabel("Title").fill("\u0085");
  await page.getByLabel("Description").fill("A title the browser trims less than the server.");

  await page.getByRole("button", { name: "Create card" }).click();

  await expect(page.getByText("Title is required", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Title")).toBeFocused();
  await expect(page).toHaveURL(/\/library\/cards\/new$/);
  await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
});

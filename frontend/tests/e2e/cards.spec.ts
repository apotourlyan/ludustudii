// The built server with the client app embedded, on a real database
// (ADR 0034). Tests run in parallel on one database, so each creates its
// own uniquely titled card and asserts only on it, never on totals or
// positions: the list is newest first, and another test may add a card at
// any moment, so a card is found by its title or opened by its ID.

import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { cardIdFromPath, deleteFromSlide, NOT_FOUND_TEXT } from "../support/cards";
import { showCard } from "../support/carousel";

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
  await page.getByRole("button", { name: "Create Card" }).click();
  // The form clears once the server has saved the card.
  await expect(page.getByLabel("Title")).toHaveValue("");

  await page.getByRole("link", { name: "Learning Cards" }).click();
  let slide = await showCard(page, title);
  await expect(slide.getByRole("strong")).toHaveText("end-to-end");

  await slide.getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue(title);
  const id = cardIdFromPath(new URL(page.url()).pathname);
  await page.getByLabel("Title").fill(edited);
  await page.getByRole("button", { name: "Update Card" }).click();

  await expect(page).toHaveURL(/\/library\/cards$/);
  slide = await showCard(page, edited);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  const dialog = await deleteFromSlide(page, slide);
  await expect(dialog).toBeHidden();
  await expect(page.getByText(edited, { exact: true })).toHaveCount(0);

  // Gone from the server too, not only from the page's list.
  await page.goto(`/library/cards/${id}/edit`);
  await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toBeVisible();
});

test("a card's editor URL opens it in the form", async ({ page, request }) => {
  const title = uniqueTitle("Direct");
  const description = "Opened by its URL.";
  const created = await request.post("/api/lcards", { data: { title, description } });
  expect(created.status()).toBe(201);
  const location = created.headers()["location"] ?? "";
  const id = location.match(/^\/api\/lcards\/([^/]+)$/)?.[1];
  expect(id, `the Location header ${JSON.stringify(location)}`).toBeTruthy();

  await page.goto(`/library/cards/${id}/edit`);

  await expect(page.getByLabel("Title")).toHaveValue(title);
  await expect(page.getByLabel("Description")).toHaveValue(description);
  await expect(page.getByRole("button", { name: "Update Card" })).toBeEnabled();

  // Keeps the list short for the other tests; the database goes when the
  // run ends either way.
  const deleted = await request.delete(location, {
    headers: { "If-Match": created.headers()["etag"] ?? "" },
  });
  expect(deleted.status()).toBe(204);
});

test("a nonexistent card ID shows the not-found page", async ({ page }) => {
  // A valid UUIDv7 that the database never generates: its time is 1970.
  await page.goto("/library/cards/00000000-0000-7000-8000-000000000000/edit");

  await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to learning cards" }).click();
  await expect(page.getByRole("heading", { name: "Learning Cards", level: 1 })).toBeVisible();
});

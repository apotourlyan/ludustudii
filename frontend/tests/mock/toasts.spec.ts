// Failures that aren't about a field are toasts (ADR 0041): a save no field
// can show, and a delete. An error toast stays until dismissed, is
// announced at once, and the same message doesn't stack a second one.
// Field errors stay on their fields (form-errors.spec.ts).

import { expect, test, type Page } from "@playwright/test";

import { deleteCard, openCardFromList } from "../support/cards";
import { cardAt, expectCardAt } from "../support/overview";
import { failedRequests, failRequests } from "../support/server-errors";
import { errorAnnouncements, toast, toasts } from "../support/toasts";

const SAVE_FAILED = "Something went wrong while trying to save your edits.";
const DELETE_FAILED = "Something went wrong while trying to delete the card.";

// Opens the newest card, "Mitochondria", on its page.
async function openNewestCard(page: Page): Promise<void> {
  await page.goto("/library/cards");
  await openCardFromList(page, cardAt(page, 1));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
}

// Fails a delete from the list, which leaves an error toast.
async function showDeleteFailure(page: Page) {
  await failRequests(page, ["DELETE"]);
  await page.goto("/library/cards");
  const dialog = await deleteCard(page, cardAt(page, 1));
  await expect(dialog).toBeHidden();
  const shown = toast(page, DELETE_FAILED);
  await expect(shown).toBeVisible();
  return shown;
}

test("a save that fails shows one toast, keeps the input and adds nothing to the form", async ({
  page,
}) => {
  await failRequests(page, ["PUT"]);
  await page.goto("/library/cards");
  await cardAt(page, 1).getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondria");
  await page.getByLabel("Title").fill("Mitochondrion");
  const submit = page.getByRole("button", { name: "Update Card" });

  await submit.click();

  await expect(toast(page, SAVE_FAILED)).toBeVisible();
  await expect(toasts(page)).toHaveCount(1);
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondrion");
  await expect(page).toHaveURL(/\/edit$/);
  // Nothing next to the buttons: the page itself shows no error.
  await expect(page.getByRole("main").getByText(SAVE_FAILED)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

  // The same failure again, while its toast is open. The button reads
  // "Update Card" again once the save has settled and reported.
  await submit.click();
  await expect.poll(() => failedRequests(page)).toBe(2);
  await expect(submit).toBeEnabled();

  await expect(toasts(page)).toHaveCount(1);
  await expect(errorAnnouncements(page, SAVE_FAILED)).toHaveCount(1);
});

test("a delete that fails in the list closes the dialog, shows a toast and keeps the card", async ({
  page,
}) => {
  await failRequests(page, ["DELETE"]);
  await page.goto("/library/cards");
  await expectCardAt(page, 1, "Mitochondria", 8);

  const dialog = await deleteCard(page, cardAt(page, 1));

  await expect(dialog).toBeHidden();
  await expect(toast(page, DELETE_FAILED)).toBeVisible();
  await expectCardAt(page, 1, "Mitochondria", 8);
});

test("a delete that fails on the card's page closes the dialog, shows a toast and stays", async ({
  page,
}) => {
  await failRequests(page, ["DELETE"]);
  await openNewestCard(page);
  const url = page.url();

  const dialog = await deleteCard(page, page.getByRole("main"));

  await expect(dialog).toBeHidden();
  await expect(toast(page, DELETE_FAILED)).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
});

test("a delete that succeeds shows no toast, in the list or on the card's page", async ({
  page,
}) => {
  await openNewestCard(page);
  await deleteCard(page, page.getByRole("main"));
  await expectCardAt(page, 1, "日本語: は vs. が", 7);

  const dialog = await deleteCard(page, cardAt(page, 1));
  await expect(dialog).toBeHidden();
  await expectCardAt(page, 1, "Python list comprehension", 6);

  await expect(toasts(page)).toHaveCount(0);
});

test("an error toast is announced at once", async ({ page }) => {
  await showDeleteFailure(page);

  // An alert is an assertive live region: assistive technology reads it
  // at once, interrupting what it was reading.
  await expect(errorAnnouncements(page, DELETE_FAILED)).toHaveCount(1);
});

test("an error toast stays a minute later, and goes when dismissed with the mouse", async ({
  page,
}) => {
  await page.clock.install();
  const shown = await showDeleteFailure(page);

  await page.clock.fastForward("01:00");
  await expect(shown).toBeVisible();

  await shown.getByRole("button", { name: "Dismiss", includeHidden: true }).click();
  await expect(toasts(page)).toHaveCount(0);
});

test("an error toast goes when dismissed with the keyboard", async ({ page }) => {
  const shown = await showDeleteFailure(page);

  // F6 moves the focus into the toasts, Tab to the newest, and Escape
  // dismisses it.
  await page.keyboard.press("F6");
  await page.keyboard.press("Tab");
  await expect(shown).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(toasts(page)).toHaveCount(0);
});

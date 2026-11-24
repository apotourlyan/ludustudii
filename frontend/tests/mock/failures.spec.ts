// Failing, slow and unreachable servers.

import { expect, test } from "@playwright/test";

import { cardAt, cardItems } from "../support/overview";
import { toast } from "../support/toasts";

test("a failing server shows the error page", async ({ page }) => {
  await page.goto("/library/cards?scenario=failing");

  // Server errors are retried twice, with a back-off of about 3 seconds in
  // all, before the error page shows.
  await expect(page.getByRole("alert")).toHaveText(
    "Something went wrong while trying to load this page.",
    { timeout: 10_000 },
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page couldn't load");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a slow server shows the pending page first", async ({ page }) => {
  // The pending page shows from the router's pendingMs (1 second) after
  // the loader starts until the delayed response arrives. goto returns as
  // soon as the page starts loading, so the check below is already polling
  // when that window opens, however long the app takes to load.
  await page.goto("/library/cards?delay=3000", { waitUntil: "commit" });

  const pending = page.getByRole("status").filter({ hasText: "Loading..." });
  await expect(pending).toBeVisible();
  await expect(cardItems(page)).toHaveCount(8);
  await expect(pending).toBeHidden();
});

test("going offline shows the network message on the next request", async ({ page, context }) => {
  await page.goto("/library/cards");
  await cardAt(page, 1).getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondria");

  await context.setOffline(true);
  await page.getByLabel("Title").fill("Mitochondrion");
  await page.getByRole("button", { name: "Update card" }).click();

  await expect(
    toast(page, "Can't reach the server. Check your connection and try again."),
  ).toBeVisible();
});

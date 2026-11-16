// Failing, slow and unreachable servers.

import { expect, test } from "@playwright/test";

import { currentSlide } from "../support/carousel";

test("a failing server shows the error page", async ({ page }) => {
  await page.goto("/library/cards?scenario=failing");

  // Server errors are retried twice, with a back-off of about 3 seconds in
  // all, before the error page shows.
  await expect(page.getByRole("alert")).toHaveText(
    "Something went wrong while trying to load this page.",
    { timeout: 10_000 },
  );
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
  await expect(page.getByRole("status")).toHaveText("1 / 8");
  await expect(pending).toBeHidden();
});

test("going offline shows the network message on the next request", async ({ page, context }) => {
  await page.goto("/library/cards");
  await currentSlide(page).getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondria");

  await context.setOffline(true);
  await page.getByLabel("Title").fill("Mitochondrion");
  await page.getByRole("button", { name: "Update Card" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Can't reach the server. Check your connection and try again.",
  );
});

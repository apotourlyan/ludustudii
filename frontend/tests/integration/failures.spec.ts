// Failing and slow servers. The waits they cause run on the page's clock,
// which the test moves on, rather than in real time. A failure the browser
// reports offline is a toast, which learning-card-form.test.tsx checks.

import { expect, test } from "@playwright/test";

import { fastForwardUntil } from "../support/clock";
import { holdRequests, releaseRequests } from "../support/fetch";
import { cardItems } from "../support/overview";

test("a failing server shows the error page", async ({ page }) => {
  await page.clock.install();
  await page.goto("/library/cards?scenario=failing");

  // Server errors are retried twice, with a back-off of about 3 seconds in
  // all, before the error page shows.
  await fastForwardUntil(page, () =>
    expect(page.getByRole("alert")).toHaveText(
      "Something went wrong while trying to load this page.",
      { timeout: 100 },
    ),
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page couldn't load");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a slow server shows the pending page first", async ({ page }) => {
  // The pending page shows from the router's pendingMs (1 second) after
  // the loader starts until the list's response arrives, which waits for
  // the test to release it.
  await holdRequests(page, "GET", /^\/api\/lcards$/);
  await page.clock.install();
  await page.goto("/library/cards");

  const pending = page.getByRole("status").filter({ hasText: "Loading..." });
  await fastForwardUntil(page, () => expect(pending).toBeVisible({ timeout: 100 }));
  await releaseRequests(page);
  await expect(cardItems(page)).toHaveCount(8);
  await expect(pending).toBeHidden();
});

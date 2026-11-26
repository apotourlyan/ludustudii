// Moves the page's clock past waits that would otherwise take real time.

import { expect, type Page } from "@playwright/test";

// Moves the page's clock, installed with page.clock.install before
// page.goto, on a second at a time until `check` passes: for a state the
// app reaches only after timers that start when the test can't see, such
// as a query's retries, which back off for about 3 seconds in all. `check`
// should fail fast, with a short timeout of its own.
export async function fastForwardUntil(page: Page, check: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await page.clock.fastForward(1000);
    await check();
  }).toPass({ intervals: [50], timeout: 10_000 });
}

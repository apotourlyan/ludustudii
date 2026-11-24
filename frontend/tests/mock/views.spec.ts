// The cards overview's two views, a list and a grid, chosen with the
// switch next to "Add card" and kept in the URL's view param.

import { expect, test, type Page } from "@playwright/test";

import { openCardFromList } from "../support/cards";
import {
  cardAt,
  cardItems,
  failListRequests,
  listRequestCount,
  watchListRequests,
} from "../support/overview";

// The switch's buttons, found in its group, named "View".
function viewButtons(page: Page) {
  const group = page.getByRole("group", { name: "View" });
  return {
    list: group.getByRole("button", { name: "List view" }),
    grid: group.getByRole("button", { name: "Grid view" }),
  };
}

test("the overview shows the list by default, and says so in the URL", async ({ page }) => {
  await page.goto("/library/cards");
  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);

  const { list, grid } = viewButtons(page);
  await expect(list).toHaveAttribute("aria-pressed", "true");
  await expect(grid).toHaveAttribute("aria-pressed", "false");
});

test("the switch changes the view and the URL, without adding history", async ({ page }) => {
  await page.goto("/library/cards/new");
  // Links to the overview name the view they open, the default list.
  await page.getByRole("link", { name: "Learning cards", exact: true }).click();
  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
  const { list, grid } = viewButtons(page);

  await grid.click();
  await expect(page).toHaveURL(/\/library\/cards\?view=grid$/);
  await expect(grid).toHaveAttribute("aria-pressed", "true");
  await expect(list).toHaveAttribute("aria-pressed", "false");

  // Pressing the view that is on keeps it on.
  await grid.click();
  await expect(page).toHaveURL(/\/library\/cards\?view=grid$/);
  await expect(grid).toHaveAttribute("aria-pressed", "true");

  await list.click();
  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
  await expect(list).toHaveAttribute("aria-pressed", "true");
  await expect(grid).toHaveAttribute("aria-pressed", "false");

  // Each switch replaced the history entry, so Back leaves the overview.
  await page.goBack();
  await expect(page).toHaveURL(/\/library\/cards\/new$/);
});

test("a reload keeps the view", async ({ page }) => {
  await page.goto("/library/cards");
  await viewButtons(page).grid.click();
  await expect(page).toHaveURL(/\?view=grid$/);

  await page.reload();

  await expect(viewButtons(page).grid).toHaveAttribute("aria-pressed", "true");
});

for (const search of ["?view=table", "?view=", "?view=GRID"]) {
  test(`an invalid view, ${search}, falls back to the list`, async ({ page }) => {
    await page.goto(`/library/cards${search}`);
    await expect(page).toHaveURL(/\/library\/cards\?view=list$/);

    const { list, grid } = viewButtons(page);
    await expect(list).toHaveAttribute("aria-pressed", "true");
    await expect(grid).toHaveAttribute("aria-pressed", "false");
  });
}

test("the redirects from / and /library keep the view", async ({ page }) => {
  for (const path of ["/", "/library"]) {
    await page.goto(`${path}?view=grid`);
    await expect(page).toHaveURL(/\/library\/cards\?view=grid$/);
    await expect(viewButtons(page).grid).toHaveAttribute("aria-pressed", "true");
  }
});

test("the navigation marks the overview as the current page in either view", async ({ page }) => {
  await page.goto("/library/cards");
  const navLink = page.getByRole("navigation").getByRole("link", { name: "Learning cards" });
  await expect(navLink).toHaveAttribute("aria-current", "page");

  await viewButtons(page).grid.click();
  await expect(page).toHaveURL(/\?view=grid$/);
  await expect(navLink).toHaveAttribute("aria-current", "page");
});

// The view is display state: the router doesn't run the overview's loader
// for a navigation that only changes the search params, unless it goes to
// the same URL (README, "Display state"). The list's staleTime
// (QUERY_STALE_TIME_MS in src/app/query-client.ts) is 30 seconds; past it,
// a loader that ran would refetch the list.
test("switching views doesn't reload the list, and entering the overview does", async ({
  page,
}) => {
  await watchListRequests(page);
  await page.clock.install();
  await page.goto("/library/cards");
  await expect(cardItems(page)).toHaveCount(8);
  await failListRequests(page);
  const before = await listRequestCount(page);
  await page.clock.fastForward("00:31");

  const { list, grid } = viewButtons(page);
  await grid.click();
  await expect(page).toHaveURL(/\?view=grid$/);
  await expect(cardItems(page)).toHaveCount(8);
  await list.click();
  await expect(page).toHaveURL(/\?view=list$/);
  await expect(cardItems(page)).toHaveCount(8);

  expect(await listRequestCount(page), "list requests while switching views").toBe(before);
  await expect(page.getByRole("alert")).toHaveCount(0);

  // A card's page fetches only that card, which still succeeds; going to
  // the overview from it enters the page, which runs the loader.
  await openCardFromList(page, cardAt(page, 1));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
  await page.getByRole("link", { name: "Learning cards", exact: true }).click();
  await expect
    .poll(() => listRequestCount(page), { message: "list requests" })
    .toBeGreaterThan(before);
});

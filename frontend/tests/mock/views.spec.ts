// The cards overview's two views, a list and a grid, chosen with the
// switch next to "Add Card" and kept in the URL's view param.

import { expect, test, type Page } from "@playwright/test";

function viewButtons(page: Page) {
  return {
    list: page.getByRole("button", { name: "List view" }),
    grid: page.getByRole("button", { name: "Grid view" }),
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
  await page.getByRole("link", { name: "Learning Cards", exact: true }).click();
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

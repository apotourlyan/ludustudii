// At the default viewport, 1280×720, an open toast covers none of the
// controls a user needs next, so a failed action can be retried at once,
// without dismissing its toast first (ADR 0041).

import { expect, test, type Locator, type Page } from "@playwright/test";

import { deleteCard, openCardFromList } from "../support/cards";
import { cardAt, expectCardAt } from "../support/overview";
import { failRequests } from "../support/server-errors";
import { toast } from "../support/toasts";

const SAVE_FAILED = "Something went wrong while trying to save your edits.";
const DELETE_FAILED = "Something went wrong while trying to delete the card.";

// Under reduced motion the toast doesn't slide in: it is where it stays
// as soon as it shows, with no animation to wait for.
test.use({ contextOptions: { reducedMotion: "reduce" } });

// Waits for any animation of the toast to finish, then checks that it
// overlaps none of the controls.
async function expectClearOf(
  page: Page,
  message: string,
  controls: Record<string, Locator>,
): Promise<void> {
  const shown = toast(page, message);
  await expect(shown).toBeVisible();
  await shown.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
  const t = (await shown.boundingBox())!;
  for (const [name, control] of Object.entries(controls)) {
    const c = (await control.boundingBox())!;
    const overlaps =
      t.x < c.x + c.width && c.x < t.x + t.width && t.y < c.y + c.height && c.y < t.y + t.height;
    expect(overlaps, `the toast ${JSON.stringify(t)} overlaps ${name} ${JSON.stringify(c)}`).toBe(
      false,
    );
  }
}

test("on the overview, the toast leaves the view switch and Add card free", async ({ page }) => {
  await failRequests(page, ["DELETE"], { times: 1 });
  await page.goto("/library/cards");
  await deleteCard(page, cardAt(page, 1));

  await expectClearOf(page, DELETE_FAILED, {
    "Add card": page.getByRole("main").getByRole("link", { name: "Add card" }),
    "List view": page.getByRole("button", { name: "List view" }),
    "Grid view": page.getByRole("button", { name: "Grid view" }),
    "the first card's Delete": cardAt(page, 1).getByRole("button", { name: "Delete" }),
  });

  const dialog = await deleteCard(page, cardAt(page, 1));
  await expect(dialog).toBeHidden();
  await expectCardAt(page, 1, "日本語: は vs. が", 7);
});

test("on a card's page, the toast leaves the card's actions free", async ({ page }) => {
  await failRequests(page, ["DELETE"], { times: 1 });
  await page.goto("/library/cards");
  await openCardFromList(page, cardAt(page, 1));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondria");
  await deleteCard(page, page.getByRole("main"));

  await expectClearOf(page, DELETE_FAILED, {
    Edit: page.getByRole("main").getByRole("link", { name: "Edit" }),
    Delete: page.getByRole("main").getByRole("button", { name: "Delete" }),
  });

  await deleteCard(page, page.getByRole("main"));
  await expect(page).toHaveURL(/\/library\/cards\?view=list$/);
  await expectCardAt(page, 1, "日本語: は vs. が", 7);
});

test("on the card form, the toast leaves the buttons free", async ({ page }) => {
  await failRequests(page, ["PUT"], { times: 1 });
  await page.goto("/library/cards");
  await cardAt(page, 1).getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Title").fill("Mitochondrion");
  const submit = page.getByRole("button", { name: "Save card" });
  await submit.click();

  await expectClearOf(page, SAVE_FAILED, {
    "Save card": submit,
    Cancel: page.getByRole("link", { name: "Cancel" }),
  });

  await submit.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mitochondrion");
});

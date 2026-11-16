// The card editor and its preview have the same bands (strip, then label
// bar, content and status bar for the title and for the description), and
// from md up the two panels line up band by band: both frames span the
// same grid rows as subgrids. Below md they stack in document order.

import { expect, test, type Locator, type Page } from "@playwright/test";

import { cardAt } from "../support/overview";

async function openEditor(page: Page): Promise<void> {
  await page.goto("/library/cards");
  await cardAt(page, 1).getByRole("link", { name: "Update" }).click();
  await expect(page.getByRole("button", { name: "Update Card" })).toBeEnabled();
}

// The two panels. The preview is the region named by its strip; the editor
// is its sibling that holds the title's field.
function panels(page: Page): { editor: Locator; preview: Locator } {
  const preview = page.getByRole("region", { name: "Preview" });
  const editor = preview
    .locator("xpath=..")
    .locator(":scope > *")
    .filter({ has: page.getByLabel("Title") });
  return { editor, preview };
}

// A full frame's bands, in LearningCardFrame's order.
const BANDS = [
  "strip",
  "title label bar",
  "title content",
  "title status bar",
  "description label bar",
  "description content",
  "description status bar",
] as const;
type Band = (typeof BANDS)[number];

// One of a panel's bands, by name.
function band(bands: Locator, name: Band): Locator {
  return bands.nth(BANDS.indexOf(name));
}

// A panel's bands, top to bottom: the children of its frame. The preview's
// frame is inside its section; the editor is the frame itself. Each band
// is checked by what it shows, so a missing or extra band fails here
// rather than comparing the wrong pair.
async function bandsOf(page: Page): Promise<{ editor: Locator; preview: Locator }> {
  const panel = panels(page);
  const editor = panel.editor.locator(":scope > *");
  const preview = panel.preview.locator(":scope > * > *");
  await expect(editor).toHaveCount(BANDS.length);
  await expect(preview).toHaveCount(BANDS.length);

  await expect(band(editor, "strip")).toHaveText("Edit");
  await expect(band(preview, "strip")).toHaveText("Preview");
  await expect(band(editor, "title label bar").getByText("Title", { exact: true })).toBeVisible();
  await expect(band(preview, "title label bar")).toHaveText("Title");
  await expect(band(editor, "title content").getByLabel("Title")).toBeVisible();
  await expect(
    band(editor, "description label bar").getByText("Description", { exact: true }),
  ).toBeVisible();
  await expect(band(preview, "description label bar")).toHaveText("Description");
  await expect(band(editor, "description content").getByLabel("Description")).toBeVisible();

  return { editor, preview };
}

async function box(locator: Locator): Promise<{ top: number; bottom: number }> {
  const found = await locator.boundingBox();
  if (!found) {
    throw new Error(`no bounding box for ${locator.toString()}`);
  }
  return { top: found.y, bottom: found.y + found.height };
}

function expectSame(actual: number, expected: number, what: string): void {
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(1);
}

// Every band's top and bottom match between the two panels, and the
// description's field fills its band: as far from the band's bottom as
// from its top.
async function expectAligned(page: Page, state: string): Promise<void> {
  const bands = await bandsOf(page);
  for (const name of BANDS) {
    const editor = await box(band(bands.editor, name));
    const preview = await box(band(bands.preview, name));
    expectSame(editor.top, preview.top, `${state}, ${name} top`);
    expectSame(editor.bottom, preview.bottom, `${state}, ${name} bottom`);
  }
  const content = await box(band(bands.editor, "description content"));
  const field = await box(page.getByLabel("Description"));
  expectSame(content.bottom - field.bottom, field.top - content.top, `${state}, description field`);
}

test.describe("at 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the preview is on the left, the editor on the right, the buttons under it", async ({
    page,
  }) => {
    await openEditor(page);
    const { editor, preview } = panels(page);
    const editorBox = (await editor.boundingBox())!;
    const previewBox = (await preview.boundingBox())!;
    const submit = (await page.getByRole("button", { name: "Update Card" }).boundingBox())!;
    expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(editorBox.x);
    expect(submit.y).toBeGreaterThanOrEqual(editorBox.y + editorBox.height);
    expectSame(submit.x + submit.width, editorBox.x + editorBox.width, "submit's right edge");
  });

  test("the editor's and the preview's bands line up", async ({ page, context }) => {
    await openEditor(page);
    const preview = panels(page).preview;
    const description = page.getByLabel("Description");
    await expectAligned(page, "as loaded");

    // Headings render taller than their text, so the preview's description
    // is the taller side, and the field stretches to match it. No blank
    // lines, which would make the text taller again: a heading ends the
    // list before it.
    await description.fill(
      Array.from({ length: 12 }, (_, i) => `## Step ${i + 1}\n- detail`).join("\n"),
    );
    await expect(preview.getByRole("heading", { name: "Step 12" })).toBeVisible();
    await expectAligned(page, "preview taller");

    // Lines without blank lines between them render as one paragraph, so
    // the text is the taller side, and the preview's band stretches.
    await description.fill(Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n"));
    await expect(preview.getByText(/line 40$/)).toBeVisible();
    await expectAligned(page, "text taller");

    // A submit that fails: the save error shows in the button row.
    await context.setOffline(true);
    await page.getByRole("button", { name: "Update Card" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expectAligned(page, "after a failed save");

    // Both fields invalid: errors in both status bars.
    await page.getByLabel("Title").fill("");
    await description.fill("");
    await expect(page.getByText("Title is required", { exact: true })).toBeVisible();
    await expect(page.getByText("Description is required", { exact: true })).toBeVisible();
    await expectAligned(page, "with both fields invalid");
  });
});

test.describe("at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the editor, the buttons and the preview stack in that order", async ({ page }) => {
    await openEditor(page);
    const { editor, preview } = panels(page);
    const buttons = await box(page.getByRole("button", { name: "Update Card" }));
    expect((await box(editor)).bottom).toBeLessThanOrEqual(buttons.top);
    expect(buttons.bottom).toBeLessThanOrEqual((await box(preview)).top);
  });
});

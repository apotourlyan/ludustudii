// From md up, the card editor and its preview sit side by side and line up
// row by row: both frames span the same grid rows as subgrids, so the
// taller part of each row sets the row's height for both.

import { expect, test, type Locator, type Page } from "@playwright/test";

import { currentSlide } from "../support/carousel";

test.use({ viewport: { width: 1280, height: 900 } });

async function openEditor(page: Page): Promise<void> {
  await page.goto("/library/cards");
  await currentSlide(page).getByRole("link", { name: "Update" }).click();
  await expect(page.getByRole("button", { name: "Update Card" })).toBeEnabled();
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

// Checks that the editor and the preview line up: their separators, and
// their bodies' tops and bottoms. The editor comes first, so its separator
// is the first of the two on the page. A frame's body has no role of its
// own; it is the element after its frame's separator.
async function expectAligned(page: Page): Promise<void> {
  const preview = page.getByRole("region", { name: "Preview" });
  const separators = page.getByRole("separator");
  await expect(separators).toHaveCount(2);
  const editorSeparator = separators.first();
  const previewSeparator = preview.getByRole("separator");
  await expect(previewSeparator).toHaveCount(1);

  const editorLine = await box(editorSeparator);
  const previewLine = await box(previewSeparator);
  expectSame(editorLine.top, previewLine.top, "separator y");

  const editorBody = await box(editorSeparator.locator("xpath=following-sibling::*[1]"));
  const previewBody = await box(previewSeparator.locator("xpath=following-sibling::*[1]"));
  expectSame(editorBody.top, previewBody.top, "body top");
  expectSame(editorBody.bottom, previewBody.bottom, "body bottom");

  // The description's field fills its body, also when the preview is the
  // taller of the two.
  const field = await box(page.getByRole("group").filter({ has: page.getByLabel("Description") }));
  expectSame(field.bottom, editorBody.bottom, "description field bottom");
}

test("the editor and its preview line up row by row", async ({ page }) => {
  await openEditor(page);
  await expectAligned(page);

  // Headings and lists render taller than their text, so the preview's body
  // is the taller one, and the description field stretches to match it. No
  // blank lines, which would make the text taller again: a heading ends the
  // list before it.
  const preview = page.getByRole("region", { name: "Preview" });
  await page
    .getByLabel("Description")
    .fill(Array.from({ length: 12 }, (_, i) => `## Step ${i + 1}\n- detail`).join("\n"));
  await expect(preview.getByRole("heading", { name: "Step 12" })).toBeVisible();
  await expectAligned(page);

  // Lines without blank lines between them render as one paragraph, so the
  // text is the taller one, and the preview's body stretches to match it.
  await page
    .getByLabel("Description")
    .fill(Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n"));
  await expect(preview.getByText(/line 40$/)).toBeVisible();
  await expectAligned(page);
});

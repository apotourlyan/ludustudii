// A card's title renders only inline Markdown, and its description's
// headings start at level 2, so the page's own <h1> stays the only one
// (#47). Checked wherever a card renders: the editor's preview, the list
// and the card's page, where the title is the page's heading.

import { expect, test, type Locator, type Page } from "@playwright/test";

import { currentSlide } from "../support/carousel";

const TITLE = "# Photosynthesis **basics**";
const DESCRIPTION = "# Light\n\nThe **light-dependent** reactions come first.";

// The element that shows the card's title, found by its text.
function titleIn(container: Locator): Locator {
  return container.getByText("Photosynthesis basics", { exact: true });
}

// The title keeps its bold and unwraps its heading; the description's "#"
// is a level-2 heading; the page has one level-1 heading.
async function expectRendered(page: Page, container: Locator): Promise<void> {
  const title = titleIn(container);
  await expect(title).toBeVisible();
  await expect(title.getByRole("strong")).toHaveText("basics");
  await expect(title.getByRole("heading")).toHaveCount(0);
  await expect(container.getByRole("heading", { name: "Light" })).toHaveJSProperty("tagName", "H2");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
}

test("a title renders inline and description headings start at level 2", async ({ page }) => {
  await page.goto("/library/cards/new");
  await page.getByLabel("Title").fill(TITLE);
  await page.getByLabel("Description").fill(DESCRIPTION);

  await expectRendered(page, page.getByRole("region", { name: "Preview" }));

  await page.getByRole("button", { name: "Create Card" }).click();

  // Creating ends on the card's page.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Photosynthesis basics");
  await expectRendered(page, page.getByRole("main"));

  await page.getByRole("link", { name: "Back to learning cards" }).click();
  const slide = currentSlide(page);
  await expect(slide).toHaveAccessibleName("1 of 9");
  await expectRendered(page, slide);
});

// Block syntax in a title is unwrapped to its text, and the line breaks
// between the blocks render as spaces: the title reads as one line.
for (const { name, title } of [
  { name: "two paragraphs", title: "Light reactions\n\nand the **Calvin** cycle" },
  { name: "a list", title: "- Light reactions\n- and the **Calvin** cycle" },
]) {
  test(`a title with ${name} reads as one line`, async ({ page }) => {
    await page.goto("/library/cards/new");
    await page.getByLabel("Title").fill(title);

    const rendered = page
      .getByRole("region", { name: "Preview" })
      .getByText("Light reactions and the Calvin cycle", { exact: true });
    await expect(rendered).toBeVisible();
    // innerText is the text as laid out, so a block left in the title
    // would show as a line break.
    await expect(rendered).toHaveJSProperty("innerText", "Light reactions and the Calvin cycle");
    await expect(rendered.locator("p, ul, ol, li")).toHaveCount(0);
    await expect(rendered.getByRole("strong")).toHaveText("Calvin");
  });
}

// A card's title renders only inline Markdown, and its description's
// headings start at level 2, so the page's own <h1> stays the only one
// (#47). Here in the editor's preview; learning-card-display.test.tsx
// checks the card's page and learning-cards-overview.test.tsx the overview.

import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { LearningCardPreview } from "./learning-card-preview";

const preview = page.getByRole("region", { name: "Preview" });

function renderPreview(title: string, description = "") {
  return render(<LearningCardPreview card={{ title, description }} />);
}

test("a title renders inline and description headings start at level 2", async () => {
  await renderPreview(
    "# Photosynthesis **basics**",
    "# Light\n\nThe **light-dependent** reactions come first.",
  );

  const title = preview.getByText("Photosynthesis basics", { exact: true });
  await expect.element(title).toBeVisible();
  await expect.element(title.getByRole("strong")).toHaveTextContent("basics");
  expect(title.getByRole("heading").elements()).toHaveLength(0);
  expect(preview.getByRole("heading", { name: "Light" }).element().tagName).toBe("H2");
  expect(page.getByRole("heading", { level: 1 }).elements()).toHaveLength(0);
});

// A title whose syntax leaves no text once unwrapped shows its source, so
// it never renders as nothing.
test.each(["---", "![diagram](x.png)"])("a title of only %j shows its source", async (title) => {
  await renderPreview(title);

  await expect.element(preview.getByText(title, { exact: true })).toBeVisible();
});

// A fenced code block in a title keeps the code style, which its language
// class used to replace.
test("a title's fenced code keeps the code style", async () => {
  await renderPreview("```js\nfoo()\n```");

  const code = preview.getByRole("code");
  await expect.element(code).toHaveTextContent("foo()");
  await expect.element(code).toHaveClass("language-js", "font-mono");
});

// Block syntax in a title is unwrapped to its text, and the line breaks
// between the blocks render as spaces: the title reads as one line.
test.each([
  { name: "two paragraphs", title: "Light reactions\n\nand the **Calvin** cycle" },
  { name: "a list", title: "- Light reactions\n- and the **Calvin** cycle" },
])("a title with $name reads as one line", async ({ title }) => {
  await renderPreview(title);

  const rendered = preview.getByText("Light reactions and the Calvin cycle", { exact: true });
  await expect.element(rendered).toBeVisible();
  // innerText is the text as laid out, so a block left in the title would
  // show as a line break.
  expect(rendered.element()).toHaveProperty("innerText", "Light reactions and the Calvin cycle");
  expect(rendered.element().querySelectorAll("p, ul, ol, li")).toHaveLength(0);
  await expect.element(rendered.getByRole("strong")).toHaveTextContent("Calvin");
});

import { expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { CardDescriptionMarkdown, CardTitleMarkdown } from "./card-markdown";

test.each([
  { kind: "title", markdown: <CardTitleMarkdown>{"Light and **chlorophyll**"}</CardTitleMarkdown> },
  {
    kind: "description",
    markdown: <CardDescriptionMarkdown>{"Light and **chlorophyll**"}</CardDescriptionMarkdown>,
  },
])("a $kind's bold text is bolder than its text, with a dashed underline", async ({ markdown }) => {
  const screen = await render(<div>{markdown}</div>);

  const strong = screen.getByText("chlorophyll", { exact: true }).element();
  expect(strong.tagName).toBe("STRONG");
  const style = getComputedStyle(strong);
  expect(style.borderBottomStyle).toBe("dashed");
  const surrounding = getComputedStyle(strong.parentElement!);
  expect(Number(style.fontWeight)).toBeGreaterThan(Number(surrounding.fontWeight));
});

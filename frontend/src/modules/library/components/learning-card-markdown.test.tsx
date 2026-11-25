import { expect, test } from "vitest";
import { render } from "vitest-browser-react";

import {
  LearningCardDescriptionMarkdown,
  LearningCardTitleMarkdown,
} from "./learning-card-markdown";

test.each([
  {
    kind: "title",
    markdown: <LearningCardTitleMarkdown>{"Light and **chlorophyll**"}</LearningCardTitleMarkdown>,
  },
  {
    kind: "description",
    markdown: (
      <LearningCardDescriptionMarkdown>
        {"Light and **chlorophyll**"}
      </LearningCardDescriptionMarkdown>
    ),
  },
])("a $kind's bold text is bolder than its text, with a dotted underline", async ({ markdown }) => {
  const screen = await render(<div>{markdown}</div>);

  const strong = screen.getByText("chlorophyll", { exact: true }).element();
  expect(strong.tagName).toBe("STRONG");
  const style = getComputedStyle(strong);
  expect(style.textDecorationLine).toBe("underline");
  expect(style.textDecorationStyle).toBe("dotted");
  const surrounding = getComputedStyle(strong.parentElement!);
  expect(Number(style.fontWeight)).toBeGreaterThan(Number(surrounding.fontWeight));
});

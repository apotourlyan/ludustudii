// A card as its own page shows it: the title as the page's one <h1>,
// inline Markdown only, and the description's Markdown with its headings
// one level down (#47).

import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { sampleCards } from "@/api/lcards/fake/factories";

import { LearningCardDisplay } from "./learning-card-display";

function sample(title: string) {
  const card = sampleCards().find((candidate) => candidate.title === title);
  expect(card, title).toBeDefined();
  return card!;
}

test("a title renders inline as the page's heading, and description headings start at level 2", async () => {
  await render(
    <LearningCardDisplay
      card={{
        title: "# Photosynthesis **basics**",
        description: "# Light\n\nThe **light-dependent** reactions come first.",
      }}
      pageHeading
    />,
  );

  const heading = page.getByRole("heading", { level: 1 });
  await expect.element(heading).toHaveTextContent("Photosynthesis basics");
  await expect.element(heading.getByRole("strong")).toHaveTextContent("basics");
  expect(page.getByRole("heading", { level: 1 }).elements()).toHaveLength(1);
  expect(page.getByRole("heading", { name: "Light" }).element().tagName).toBe("H2");
});

// "Ser vs. estar": two "##" headings, one level down as <h3>s, and bold text.
test("a description's headings and bold text render", async () => {
  await render(<LearningCardDisplay card={sample("Ser vs. estar")} pageHeading />);

  await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Ser vs. estar");
  expect(
    page
      .getByRole("heading", { level: 3 })
      .elements()
      .map((element) => element.textContent),
  ).toEqual(["Ser", "Estar"]);
  expect(
    page
      .getByRole("strong")
      .elements()
      .map((element) => element.textContent),
  ).toEqual(["DOCTOR", "PLACE"]);
});

// "Binary search": a numbered list, bold text and inline code.
test("a description's list, bold text and inline code render", async () => {
  await render(<LearningCardDisplay card={sample("Binary search")} pageHeading />);

  await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Binary search");
  expect(page.getByRole("listitem").elements()).toHaveLength(3);
  await expect.element(page.getByRole("strong")).toHaveTextContent("sorted");
  expect(
    page
      .getByRole("code")
      .elements()
      .map((element) => element.textContent),
  ).toEqual(["O(log n)", "O(1)"]);
  expect(page.getByText("**sorted**").elements()).toHaveLength(0);
});

import { expect, test } from "vitest";
import { page } from "vitest/browser";

import { makeCards } from "@/api/lcards/fake/factories";
import { renderWithProviders } from "@/test/render";

import type { LearningCardsView } from "../model/learning-cards-view";
import { LearningCardsOverview } from "./learning-cards-overview";

const cards = makeCards(3, (index) => ({ title: `Card ${index + 1}` }));

// The overview in a router, for the cards' links.
function renderOverview(view: LearningCardsView, overviewCards = cards) {
  return renderWithProviders(
    <LearningCardsOverview
      cards={overviewCards}
      view={view}
      now={Date.now()}
      initialScrollOffset={0}
    />,
    { url: "/" },
  );
}

// How tall the first card's item is: a list row is 48px, a grid card 144px.
function firstItemHeight(): number | undefined {
  return page
    .getByRole("list", { name: "Learning cards" })
    .element()
    .querySelector('li[aria-posinset="1"]')
    ?.getBoundingClientRect().height;
}

test("without cards, shows the empty state", async () => {
  await renderOverview("list", []);

  await expect
    .element(page.getByText("No learning cards yet. Add a card to get started."))
    .toBeVisible();
  await expect.element(page.getByRole("list", { name: "Learning cards" })).not.toBeInTheDocument();
});

test("in the list view, shows the cards as a list", async () => {
  await renderOverview("list");

  await expect.element(page.getByText("Card 1", { exact: true })).toBeVisible();
  expect(firstItemHeight()).toBe(48);
  await expect.element(page.getByText("No learning cards yet.")).not.toBeInTheDocument();
});

test("in the grid view, shows the cards as a grid", async () => {
  await renderOverview("grid");

  await expect.element(page.getByText("Card 1", { exact: true })).toBeVisible();
  expect(firstItemHeight()).toBe(144);
  await expect.element(page.getByText("No learning cards yet.")).not.toBeInTheDocument();
});

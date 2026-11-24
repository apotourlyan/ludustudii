import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { makeCards } from "@/api/lcards/fake/factories";

import type { VirtualCardListState } from "./virtual-card-list.state";
import { VirtualCardListView } from "./virtual-card-list.view";

const cards = makeCards(300, (index) => ({ title: `Card ${index + 1}` }));

function props(overrides: Partial<VirtualCardListState> = {}): VirtualCardListState {
  return {
    cards,
    columns: 1,
    rowHeight: 50,
    gap: 10,
    overscan: 2,
    initialScrollOffset: 0,
    renderCard: (card) => <button type="button">{card.title}</button>,
    keptRow: null,
    onFocus: () => {},
    onBlur: () => {},
    ...overrides,
  };
}

const item = (position: number) =>
  page
    .getByRole("list", { name: "Learning cards" })
    .element()
    .querySelector(`li[aria-posinset="${position}"]`);

const top = (position: number) => item(position)?.getBoundingClientRect().top;

test("renders the rows near the window, each item placed among all the cards", async () => {
  await render(<VirtualCardListView {...props()} />);

  const list = page.getByRole("list", { name: "Learning cards" });
  await expect.element(list.getByRole("button", { name: "Card 1", exact: true })).toBeVisible();
  expect(item(1)).toHaveAttribute("aria-setsize", "300");
  // Far below the window: not rendered.
  expect(item(250)).toBeNull();
});

test("renders the kept row wherever the window is", async () => {
  await render(<VirtualCardListView {...props({ keptRow: 249 })} />);

  await expect.element(page.getByRole("button", { name: "Card 250" })).toBeInTheDocument();
  expect(item(250)).not.toBeNull();
  expect(item(249)).toBeNull();
});

test("lays out rows of several cards", async () => {
  await render(<VirtualCardListView {...props({ columns: 3 })} />);

  await expect.element(page.getByRole("button", { name: "Card 3", exact: true })).toBeVisible();
  // The first row's three cards share its top; the fourth starts the next.
  expect(top(1)).toBe(top(3));
  expect(top(4)).toBe((top(1) ?? 0) + 60);
});

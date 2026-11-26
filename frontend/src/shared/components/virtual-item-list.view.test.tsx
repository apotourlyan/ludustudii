import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import type { VirtualItemListState } from "./virtual-item-list.state";
import { VirtualItemListView } from "./virtual-item-list.view";

interface Item {
  id: string;
  title: string;
}

const items: Item[] = Array.from({ length: 300 }, (_, index) => ({
  id: `item-${index + 1}`,
  title: `Item ${index + 1}`,
}));

function props(overrides: Partial<VirtualItemListState<Item>> = {}): VirtualItemListState<Item> {
  return {
    items,
    label: "Items",
    columns: 1,
    rowHeight: 50,
    gap: 10,
    overscan: 2,
    initialScrollOffset: 0,
    renderItem: (item) => <button type="button">{item.title}</button>,
    keptRow: null,
    onFocus: () => {},
    onBlur: () => {},
    ...overrides,
  };
}

const item = (position: number) =>
  page
    .getByRole("list", { name: "Items" })
    .element()
    .querySelector(`li[aria-posinset="${position}"]`);

const top = (position: number) => item(position)?.getBoundingClientRect().top;

test("renders the rows near the window, each item placed among all the items", async () => {
  await render(<VirtualItemListView {...props()} />);

  const list = page.getByRole("list", { name: "Items" });
  await expect.element(list.getByRole("button", { name: "Item 1", exact: true })).toBeVisible();
  expect(item(1)).toHaveAttribute("aria-setsize", "300");
  // Far below the window: not rendered.
  expect(item(250)).toBeNull();
});

test("renders the kept row wherever the window is", async () => {
  await render(<VirtualItemListView {...props({ keptRow: 249 })} />);

  await expect.element(page.getByRole("button", { name: "Item 250" })).toBeInTheDocument();
  expect(item(250)).not.toBeNull();
  expect(item(249)).toBeNull();
});

test("lays out rows of several items", async () => {
  await render(<VirtualItemListView {...props({ columns: 3 })} />);

  await expect.element(page.getByRole("button", { name: "Item 3", exact: true })).toBeVisible();
  // The first row's three items share its top; the fourth starts the next.
  expect(top(1)).toBe(top(3));
  expect(top(4)).toBe((top(1) ?? 0) + 60);
});

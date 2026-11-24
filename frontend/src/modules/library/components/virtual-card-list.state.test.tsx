import { expect, test } from "vitest";
import { renderHook } from "vitest-browser-react";

import { makeCards } from "@/api/lcards/fake/factories";

import { useVirtualCardList, type VirtualCardListProps } from "./virtual-card-list.state";

const cards = makeCards(10);

function propsFor(overrides: Partial<VirtualCardListProps> = {}): VirtualCardListProps {
  return {
    cards,
    columns: 3,
    rowHeight: 100,
    gap: 16,
    overscan: 2,
    initialScrollOffset: 0,
    renderCard: () => null,
    ...overrides,
  };
}

// A list with an item at `position` holding a button, as the view renders
// a card's actions.
function listWithItem(position: number) {
  const list = document.createElement("ul");
  const item = document.createElement("li");
  item.setAttribute("aria-posinset", String(position));
  const button = document.createElement("button");
  item.append(button);
  list.append(item);
  return { list, button };
}

test("passes the list's props on, with no row kept while nothing has the focus", async () => {
  const props = propsFor();
  const { result } = await renderHook(() => useVirtualCardList(props));

  expect(result.current).toMatchObject({ ...props, keptRow: null });
});

test("keeps the row of the card whose item has the focus", async () => {
  const { result, act } = await renderHook(() => useVirtualCardList(propsFor()));
  const { button } = listWithItem(8);

  await act(() => result.current.onFocus({ target: button }));

  // The eighth card is in the third row of three.
  expect(result.current.keptRow).toBe(2);
});

test("keeps the row while the focus moves inside the list, and drops it when it leaves", async () => {
  const { result, act } = await renderHook(() => useVirtualCardList(propsFor()));
  const { list, button } = listWithItem(4);
  await act(() => result.current.onFocus({ target: button }));

  await act(() => result.current.onBlur({ currentTarget: list, relatedTarget: button }));
  expect(result.current.keptRow).toBe(1);

  await act(() => result.current.onBlur({ currentTarget: list, relatedTarget: null }));
  expect(result.current.keptRow).toBeNull();
});

test("follows the focused card when cards before it go", async () => {
  const { result, act, rerender } = await renderHook(
    (props?: VirtualCardListProps) => useVirtualCardList(props ?? propsFor()),
    { initialProps: propsFor() },
  );
  const { button } = listWithItem(7);
  await act(() => result.current.onFocus({ target: button }));
  expect(result.current.keptRow).toBe(2);

  await rerender(propsFor({ cards: cards.slice(3) }));

  // The seventh card is now the fourth: the second row.
  expect(result.current.keptRow).toBe(1);
});

test("keeps no row when the focused card is gone", async () => {
  const { result, act, rerender } = await renderHook(
    (props?: VirtualCardListProps) => useVirtualCardList(props ?? propsFor()),
    { initialProps: propsFor() },
  );
  const { button } = listWithItem(1);
  await act(() => result.current.onFocus({ target: button }));

  await rerender(propsFor({ cards: cards.slice(1) }));

  expect(result.current.keptRow).toBeNull();
});

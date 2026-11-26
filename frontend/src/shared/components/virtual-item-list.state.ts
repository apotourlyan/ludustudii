import { useState, type ReactNode } from "react";

import { rowOfItem } from "@/shared/lib/item-rows";

export interface VirtualItemListProps<Item extends { id: string }> {
  items: Item[];
  // The list's accessible name.
  label: string;
  columns: number;
  rowHeight: number;
  gap: number;
  overscan: number;
  initialScrollOffset: number;
  renderItem: (item: Item) => ReactNode;
}

// Which item holds the keyboard focus, so its row stays rendered wherever
// the window is scrolled: the focus isn't lost, and the next Tab goes on
// from it. Kept by ID rather than position, so the right item stays
// rendered when items before it are added or removed. Returns the list's
// props, the row to keep rendered (null when the focus is outside the
// list), and the list's focus handlers, for VirtualItemListView.
export function useVirtualItemList<Item extends { id: string }>(props: VirtualItemListProps<Item>) {
  const { items, columns } = props;
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // The focus moved to an element in the list: the item is the one whose
  // list item holds it.
  function handleFocus(event: { target: Element }) {
    const position = Number(event.target.closest("li")?.getAttribute("aria-posinset"));
    setFocusedId(items[position - 1]?.id ?? null);
  }

  // The focus left an element in the list, for one outside it or none.
  function handleBlur(event: { currentTarget: Element; relatedTarget: Element | null }) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusedId(null);
    }
  }

  return {
    ...props,
    keptRow: rowOfItem(items, focusedId, columns),
    onFocus: handleFocus,
    onBlur: handleBlur,
  };
}

export type VirtualItemListState<Item extends { id: string }> = ReturnType<
  typeof useVirtualItemList<Item>
>;

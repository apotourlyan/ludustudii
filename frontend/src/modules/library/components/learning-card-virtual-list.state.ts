import { useState, type ReactNode } from "react";

import type { LearningCard } from "@/api/lcards";

import { rowOfCard } from "../model/learning-card-rows";

export interface LearningCardVirtualListProps {
  cards: LearningCard[];
  columns: number;
  rowHeight: number;
  gap: number;
  overscan: number;
  initialScrollOffset: number;
  renderCard: (card: LearningCard) => ReactNode;
}

// Which card holds the keyboard focus, so its row stays rendered wherever
// the window is scrolled: the focus isn't lost, and the next Tab goes on
// from it. Kept by ID rather than position, so the right card stays
// rendered when cards before it are added or removed. Returns the list's
// props, the row to keep rendered (null when the focus is outside the
// list), and the list's focus handlers, for LearningCardVirtualListView.
export function useLearningCardVirtualList(props: LearningCardVirtualListProps) {
  const { cards, columns } = props;
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // The focus moved to an element in the list: the card is the one whose
  // item holds it.
  function handleFocus(event: { target: Element }) {
    const position = Number(event.target.closest("li")?.getAttribute("aria-posinset"));
    setFocusedId(cards[position - 1]?.id ?? null);
  }

  // The focus left an element in the list, for one outside it or none.
  function handleBlur(event: { currentTarget: Element; relatedTarget: Element | null }) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(null);
  }

  return {
    ...props,
    keptRow: rowOfCard(cards, focusedId, columns),
    onFocus: handleFocus,
    onBlur: handleBlur,
  };
}

export type LearningCardVirtualListState = ReturnType<typeof useLearningCardVirtualList>;

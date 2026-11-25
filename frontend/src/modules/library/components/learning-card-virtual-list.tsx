import {
  useLearningCardVirtualList,
  type LearningCardVirtualListProps,
} from "./learning-card-virtual-list.state";
import { LearningCardVirtualListView } from "./learning-card-virtual-list.view";

// The overview's virtualized list of cards, for both of its views (ADR
// 0042: keeping the focused card rendered in
// learning-card-virtual-list.state.ts, the virtualizer and the markup in
// learning-card-virtual-list.view.tsx).
export function LearningCardVirtualList(props: LearningCardVirtualListProps) {
  return <LearningCardVirtualListView {...useLearningCardVirtualList(props)} />;
}

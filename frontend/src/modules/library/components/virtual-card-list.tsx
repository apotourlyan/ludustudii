import { useVirtualCardList, type VirtualCardListProps } from "./virtual-card-list.state";
import { VirtualCardListView } from "./virtual-card-list.view";

// The overview's virtualized list of cards, for both of its views (ADR
// 0042: keeping the focused card rendered in virtual-card-list.state.ts,
// the virtualizer and the markup in virtual-card-list.view.tsx).
export function VirtualCardList(props: VirtualCardListProps) {
  return <VirtualCardListView {...useVirtualCardList(props)} />;
}

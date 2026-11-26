import { useVirtualItemList, type VirtualItemListProps } from "./virtual-item-list.state";
import { VirtualItemListView } from "./virtual-item-list.view";

// A virtualized list of items, in rows of one or more (ADR 0042: keeping
// the focused item rendered in virtual-item-list.state.ts, the virtualizer
// and the markup in virtual-item-list.view.tsx).
export function VirtualItemList<Item extends { id: string }>(props: VirtualItemListProps<Item>) {
  return <VirtualItemListView {...useVirtualItemList(props)} />;
}

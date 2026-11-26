import {
  useCollectionViewSwitch,
  type CollectionViewSwitchProps,
} from "./collection-view-switch.state";
import { CollectionViewSwitchView } from "./collection-view-switch.view";

// Switches a collection between its views; one is always on (ADR 0042:
// the value and its change in collection-view-switch.state.ts, the markup
// in collection-view-switch.view.tsx).
export function CollectionViewSwitch(props: CollectionViewSwitchProps) {
  return <CollectionViewSwitchView {...useCollectionViewSwitch(props)} />;
}

import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour";

import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

import type { CollectionViewSwitchState } from "./collection-view-switch.state";

// A collection's views as a group named "View", from what
// useCollectionViewSwitch returns. Each button is an icon with its name as
// hidden text; the one that is on is pressed.
export function CollectionViewSwitchView({ value, onValueChange }: CollectionViewSwitchState) {
  return (
    <ToggleGroup
      aria-label="View"
      variant="outline"
      size="sm"
      spacing={0}
      value={value}
      onValueChange={onValueChange}
    >
      <ToggleGroupItem value="list">
        <ListIcon />
        <span className="sr-only">List view</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="grid">
        <SquaresFourIcon />
        <span className="sr-only">Grid view</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

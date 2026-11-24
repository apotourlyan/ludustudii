import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour";

import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

import type { CardsViewSwitchState } from "./cards-view-switch.state";

// The overview's views as a group named "View", from what
// useCardsViewSwitch returns. Each button is an icon with its name as
// hidden text, like the cards' actions; the one that is on is pressed.
export function CardsViewSwitchView({ value, onValueChange }: CardsViewSwitchState) {
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

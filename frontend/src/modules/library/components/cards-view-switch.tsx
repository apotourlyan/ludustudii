import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour";

import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

import type { CardsView } from "../model/cards-view";

// Switches the cards overview between its views, as a group named
// "View". Each button is an icon with its name as hidden text, like the
// cards' actions; the one that is on is pressed. Pressing it again keeps
// it on: one view is always shown.
export function CardsViewSwitch({
  view,
  onChange,
}: {
  view: CardsView;
  onChange: (view: CardsView) => void;
}) {
  return (
    <ToggleGroup
      aria-label="View"
      variant="outline"
      size="sm"
      spacing={0}
      value={[view]}
      onValueChange={(values) => {
        const next = values.find((value): value is CardsView => value !== view);
        if (next) onChange(next);
      }}
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

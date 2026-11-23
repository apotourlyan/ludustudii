import { useCardsViewSwitch, type CardsViewSwitchProps } from "./cards-view-switch.state";
import { CardsViewSwitchView } from "./cards-view-switch.view";

// Switches the cards overview between its views; one is always on (ADR
// 0042: the value and its change in cards-view-switch.state.ts, the markup
// in cards-view-switch.view.tsx).
export function CardsViewSwitch(props: CardsViewSwitchProps) {
  return <CardsViewSwitchView {...useCardsViewSwitch(props)} />;
}

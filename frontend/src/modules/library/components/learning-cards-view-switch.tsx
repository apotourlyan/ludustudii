import {
  useLearningCardsViewSwitch,
  type LearningCardsViewSwitchProps,
} from "./learning-cards-view-switch.state";
import { LearningCardsViewSwitchView } from "./learning-cards-view-switch.view";

// Switches the cards overview between its views; one is always on (ADR
// 0042: the value and its change in learning-cards-view-switch.state.ts,
// the markup in learning-cards-view-switch.view.tsx).
export function LearningCardsViewSwitch(props: LearningCardsViewSwitchProps) {
  return <LearningCardsViewSwitchView {...useLearningCardsViewSwitch(props)} />;
}

import { toggledLearningCardsView, type LearningCardsView } from "../model/learning-cards-view";

export interface LearningCardsViewSwitchProps {
  view: LearningCardsView;
  onChange: (view: LearningCardsView) => void;
}

// The view switch's value and its change: the view that is on is the one
// pressed, pressing the other one calls onChange with it, and pressing
// the one that is on does nothing, so one view is always shown. Returns
// what LearningCardsViewSwitchView renders.
export function useLearningCardsViewSwitch({ view, onChange }: LearningCardsViewSwitchProps) {
  function handleValueChange(pressed: readonly unknown[]) {
    const next = toggledLearningCardsView(pressed, view);
    if (next) onChange(next);
  }

  return {
    value: [view],
    onValueChange: handleValueChange,
  };
}

export type LearningCardsViewSwitchState = ReturnType<typeof useLearningCardsViewSwitch>;

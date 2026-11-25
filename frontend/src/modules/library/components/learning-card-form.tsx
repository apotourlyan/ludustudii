import type { ReactNode } from "react";

import { useLearningCardForm, type LearningCardFormProps } from "./learning-card-form.state";
import { LearningCardFormView } from "./learning-card-form.view";

// Creates a card, or updates the given one: the editor, its buttons, and
// a preview of the card. Its page places it and gives it a heading. The
// state and the save workflow are in learning-card-form.state.ts, the
// markup in learning-card-form.view.tsx (ADR 0042).
export function LearningCardForm(props: LearningCardFormProps): ReactNode {
  return <LearningCardFormView {...useLearningCardForm(props)} />;
}

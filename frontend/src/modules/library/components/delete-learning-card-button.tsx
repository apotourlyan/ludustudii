import {
  useDeleteLearningCardButton,
  type DeleteLearningCardButtonProps,
} from "./delete-learning-card-button.state";
import { DeleteLearningCardButtonView } from "./delete-learning-card-button.view";

// Deletes the card after the user confirms (ADR 0042: the dialog's state
// and the delete in delete-learning-card-button.state.ts, the markup in
// delete-learning-card-button.view.tsx).
export function DeleteLearningCardButton(props: DeleteLearningCardButtonProps) {
  return <DeleteLearningCardButtonView {...useDeleteLearningCardButton(props)} />;
}

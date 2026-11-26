import {
  useConfirmDeleteButton,
  type ConfirmDeleteButtonProps,
} from "./confirm-delete-button.state";
import { ConfirmDeleteButtonView } from "./confirm-delete-button.view";

// Deletes something after the user confirms, for any module: the module
// gives the dialog's text, the delete and its failure's wording (ADR 0042:
// the dialog's state and the delete in confirm-delete-button.state.ts, the
// markup in confirm-delete-button.view.tsx).
export function ConfirmDeleteButton(props: ConfirmDeleteButtonProps) {
  return <ConfirmDeleteButtonView {...useConfirmDeleteButton(props)} />;
}

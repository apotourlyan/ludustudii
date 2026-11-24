import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

import type { DeleteLearningCardButtonState } from "./delete-learning-card-button.state";

// The delete button, an icon named "Delete" in hidden text like the other
// actions, and the dialog that asks to confirm, from what
// useDeleteLearningCardButton returns. While deleting, both of the
// dialog's buttons are disabled.
export function DeleteLearningCardButtonView({
  open,
  onOpenChange,
  onConfirm,
  deleting,
  confirmLabel,
}: DeleteLearningCardButtonState) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger render={<Button variant="destructive" size="icon-sm" />}>
        <TrashIcon />
        <span className="sr-only">Delete</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this learning card?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The card will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={deleting} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

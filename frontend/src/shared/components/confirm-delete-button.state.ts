import { useState } from "react";

import { useErrorToast } from "@/shared/lib/use-error-toast";

export interface ConfirmDeleteButtonProps {
  // The dialog's question and what follows from it, such as that the
  // delete can't be undone.
  title: string;
  description: string;
  // Deletes the thing; the promise settles when the delete does, and
  // rejects when it fails.
  onConfirm: () => Promise<unknown>;
  // The toast's text for a failed delete, in the module's wording.
  failureMessage: (error: unknown) => string;
  // Called after the delete succeeds; the page decides what follows, such
  // as leaving the deleted thing's page (ADR 0036).
  onDeleted?: () => void;
}

// The delete button's confirmation dialog and its delete: the dialog
// closes when the delete settles, and can't be closed while it runs. A
// failure is a toast, which outlives the dialog and the deleted thing's
// row (ADR 0041); a success calls onDeleted. Returns what
// ConfirmDeleteButtonView renders.
export function useConfirmDeleteButton({
  title,
  description,
  onConfirm,
  failureMessage,
  onDeleted,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The toast of the last failed delete, if any (ADR 0041).
  const deleteError = useErrorToast();

  // Awaited rather than given callbacks, which wouldn't run if the button
  // unmounted first, such as when a refetch drops the deleted thing's row.
  async function confirmDelete() {
    // Trying again replaces what the last attempt reported.
    deleteError.clear();
    setDeleting(true);
    try {
      await onConfirm();
    } catch (error) {
      deleteError.show(failureMessage(error));
      return;
    } finally {
      setDeleting(false);
      setOpen(false);
    }
    onDeleted?.();
  }

  // Keeps the dialog open until the delete settles.
  function handleOpenChange(nextOpen: boolean) {
    if (!deleting) {
      setOpen(nextOpen);
    }
  }

  return {
    title,
    description,
    open,
    onOpenChange: handleOpenChange,
    onConfirm: () => void confirmDelete(),
    deleting,
    confirmLabel: deleting ? "Deleting..." : "Delete",
  };
}

export type ConfirmDeleteButtonState = ReturnType<typeof useConfirmDeleteButton>;

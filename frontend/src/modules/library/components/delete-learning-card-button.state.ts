import { useState } from "react";

import { useDeleteLearningCard, type LearningCard } from "@/api/lcards";
import { useErrorToast } from "@/shared/use-error-toast";

import { learningCardErrorMessage } from "../model/learning-card-error-message";

export interface DeleteLearningCardButtonProps {
  card: Pick<LearningCard, "id">;
  // Called after the card is deleted; the page decides what follows, such
  // as leaving the card's page (ADR 0036).
  onDeleted?: () => void;
}

// The delete button's confirmation dialog and its delete: the dialog
// closes when the request settles, and can't be closed while it runs. A
// failure is a toast, which outlives the dialog and the card's row (ADR
// 0041); a success calls onDeleted. Returns what
// DeleteLearningCardButtonView renders.
export function useDeleteLearningCardButton({ card, onDeleted }: DeleteLearningCardButtonProps) {
  const [open, setOpen] = useState(false);
  const deleteCard = useDeleteLearningCard();
  // The toast of the last failed delete, if any (ADR 0041).
  const deleteError = useErrorToast();
  const deleting = deleteCard.isPending;

  // Awaited rather than given callbacks, which wouldn't run if the button
  // unmounted first, such as when a refetch drops the card's row.
  async function confirmDelete() {
    // Trying again replaces what the last attempt reported.
    deleteError.clear();
    try {
      await deleteCard.mutateAsync({ id: card.id });
    } catch (error) {
      setOpen(false);
      deleteError.show(learningCardErrorMessage(error, "delete the card"));
      return;
    }
    setOpen(false);
    onDeleted?.();
  }

  // Keeps the dialog open until the request settles.
  function handleOpenChange(nextOpen: boolean) {
    if (!deleting) {
      setOpen(nextOpen);
    }
  }

  return {
    open,
    onOpenChange: handleOpenChange,
    onConfirm: () => void confirmDelete(),
    deleting,
    confirmLabel: deleting ? "Deleting..." : "Delete",
  };
}

export type DeleteLearningCardButtonState = ReturnType<typeof useDeleteLearningCardButton>;

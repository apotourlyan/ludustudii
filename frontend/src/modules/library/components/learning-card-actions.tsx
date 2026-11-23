import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { useDeleteLearningCard, type LearningCard } from "@/api/lcards";
import { notifyError } from "@/shared/notify";
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
import { Button, buttonVariants } from "@/shared/ui/button";

import { cardErrorMessage } from "./card-error-message";

// What can be done with a saved card, for the places that show one to
// compose in their actions slot. The links let the router preload the
// card's page while the pointer hovers them.
//
// Each action is an icon. Its name is hidden text, so assistive technology
// and tests find it by name.

const ACTION = buttonVariants({ variant: "outline", size: "icon-sm" });

// All three, in a row: open, update, delete.
export function LearningCardActions({ card }: { card: Pick<LearningCard, "id"> }) {
  return (
    <div className="flex gap-2">
      <OpenLearningCardLink card={card} />
      <UpdateLearningCardLink card={card} />
      <DeleteLearningCardButton card={card} />
    </div>
  );
}

// Opens the card's own page.
export function OpenLearningCardLink({ card }: { card: Pick<LearningCard, "id"> }) {
  return (
    <Link to="/library/cards/$cardId" params={{ cardId: card.id }} className={ACTION}>
      <ArrowSquareOutIcon />
      <span className="sr-only">Open</span>
    </Link>
  );
}

// Opens the card's editor.
export function UpdateLearningCardLink({ card }: { card: Pick<LearningCard, "id"> }) {
  return (
    <Link to="/library/cards/$cardId/edit" params={{ cardId: card.id }} className={ACTION}>
      <PencilSimpleIcon />
      <span className="sr-only">Update</span>
    </Link>
  );
}

// Deletes the card after the user confirms. The dialog closes when the
// request settles. A failure is a toast, which outlives the dialog and the
// card's row (ADR 0041); a success calls onDeleted, which tells the page,
// which may leave (ADR 0036).
export function DeleteLearningCardButton({
  card,
  onDeleted,
}: {
  card: Pick<LearningCard, "id">;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const deleteCard = useDeleteLearningCard();
  // Closes the toast of the last failed delete, if any (ADR 0041).
  const dismissDeleteError = useRef<(() => void) | undefined>(undefined);

  // Awaited rather than given callbacks, which wouldn't run if the button
  // unmounted first, such as when a refetch drops the card's row.
  async function confirmDelete() {
    // Trying again replaces what the last attempt reported.
    dismissDeleteError.current?.();
    dismissDeleteError.current = undefined;
    try {
      await deleteCard.mutateAsync({ id: card.id });
    } catch (error) {
      setOpen(false);
      dismissDeleteError.current = notifyError(cardErrorMessage(error, "delete the card"));
      return;
    }
    setOpen(false);
    onDeleted?.();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Keep the dialog open until the request settles
        if (deleteCard.isPending) return;
        setOpen(nextOpen);
      }}
    >
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
          <AlertDialogCancel disabled={deleteCard.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteCard.isPending}
            onClick={() => void confirmDelete()}
          >
            {deleteCard.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

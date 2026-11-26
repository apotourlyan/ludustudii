import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { Link } from "@tanstack/react-router";

import { useDeleteLearningCard, type LearningCard } from "@/api/lcards";
import { ConfirmDeleteButton } from "@/shared/components/confirm-delete-button";
import { buttonVariants } from "@/shared/ui/button";

import { learningCardErrorMessage } from "../model/learning-card-error-message";

// What can be done with a saved card, for the places that show one to
// compose in their actions slot. The links let the router preload the
// card's page while the pointer hovers them. The delete binds the card to
// the shared ConfirmDeleteButton, whose dialog and delete behave the same
// for every module.
//
// Each action is an icon. Its name is hidden text, so assistive technology
// and tests find it by name.

const ACTION = buttonVariants({ variant: "outline", size: "icon-sm" });

// All three, in a row: open, update, delete.
export function LearningCardActions({ card }: { card: Pick<LearningCard, "id"> }) {
  return (
    <div className="flex gap-2">
      <LearningCardOpenLink card={card} />
      <LearningCardUpdateLink card={card} />
      <LearningCardDeleteButton card={card} />
    </div>
  );
}

// Opens the card's own page.
export function LearningCardOpenLink({ card }: { card: Pick<LearningCard, "id"> }) {
  return (
    <Link to="/library/cards/$cardId" params={{ cardId: card.id }} className={ACTION}>
      <ArrowSquareOutIcon />
      <span className="sr-only">Open</span>
    </Link>
  );
}

// Opens the card's editor.
export function LearningCardUpdateLink({ card }: { card: Pick<LearningCard, "id"> }) {
  return (
    <Link to="/library/cards/$cardId/edit" params={{ cardId: card.id }} className={ACTION}>
      <PencilSimpleIcon />
      <span className="sr-only">Update</span>
    </Link>
  );
}

// Deletes the card after the user confirms. onDeleted is called after the
// card is deleted; the page decides what follows, such as leaving the
// card's page (ADR 0036).
export function LearningCardDeleteButton({
  card,
  onDeleted,
}: {
  card: Pick<LearningCard, "id">;
  onDeleted?: () => void;
}) {
  const deleteCard = useDeleteLearningCard();
  return (
    <ConfirmDeleteButton
      title="Delete this learning card?"
      description="This action cannot be undone. The card will be permanently removed."
      onConfirm={() => deleteCard.mutateAsync({ id: card.id })}
      failureMessage={(error) => learningCardErrorMessage(error, "delete the card")}
      onDeleted={onDeleted}
    />
  );
}

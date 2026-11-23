import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { Link } from "@tanstack/react-router";

import type { LearningCard } from "@/api/lcards";
import { buttonVariants } from "@/shared/ui/button";

import { DeleteLearningCardButton } from "./delete-learning-card-button";

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

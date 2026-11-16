import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { useDeleteLearningCard, type LearningCard } from "@/api/lcards";
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
import { CardTitle } from "@/shared/ui/card";
import { FieldError } from "@/shared/ui/field";

import { cardErrorMessage } from "./card-error-message";
import { CardMarkdown } from "./card-markdown";
import { LearningCardFrame } from "./learning-card-frame";

// A saved card with its actions: a link to edit it, and deleting it. Its
// parent places it.
export function LearningCardView({ card }: { card: LearningCard }) {
  return (
    <LearningCardDisplay
      card={card}
      actions={
        <div className="flex gap-2">
          {/* A link, so the router preloads the card while the pointer hovers it. */}
          <Link
            to="/library/cards/$cardId"
            params={{ cardId: card.id }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Update
          </Link>
          <DeleteLearningCardButton card={card} />
        </div>
      }
    />
  );
}

function DeleteLearningCardButton({ card }: { card: LearningCard }) {
  const [open, setOpen] = useState(false);
  const deleteCard = useDeleteLearningCard();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Keep the dialog open until the request settles
        if (deleteCard.isPending) return;
        if (!nextOpen) deleteCard.reset();
        setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this learning card?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The card will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteCard.isError && (
          <FieldError>{cardErrorMessage(deleteCard.error, "delete the card")}</FieldError>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCard.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteCard.isPending}
            onClick={() =>
              deleteCard.mutate(
                { id: card.id, version: card.version },
                {
                  onSuccess: () => setOpen(false),
                },
              )
            }
          >
            {deleteCard.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// A card's title and description as Markdown, in the frame every mode of
// a card shares, with no strip and no bars.
export function LearningCardDisplay({
  card,
  actions,
}: {
  card: Pick<LearningCard, "title" | "description">;
  actions?: ReactNode;
}) {
  return (
    <LearningCardFrame
      actions={actions}
      title={{
        content: (
          <CardTitle className="min-w-0 wrap-break-word">
            <CardMarkdown>{card.title}</CardMarkdown>
          </CardTitle>
        ),
      }}
      description={{
        content: <CardMarkdown>{card.description}</CardMarkdown>,
      }}
    />
  );
}

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import Markdown, { type Components } from "react-markdown";

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
import { FieldError } from "@/shared/ui/field";
import { Separator } from "@/shared/ui/separator";

import { cardErrorMessage } from "./card-error-message";
import { LearningCardFrame, type LearningCardFrameProps } from "./learning-card-frame";

// Tailwind preflight resets element styles, so markdown elements are styled here
const markdownComponents: Components = {
  h1: ({ node: _node, children, ...props }) => (
    <h1 className="mt-4 mb-2 text-lg font-semibold first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ node: _node, children, ...props }) => (
    <h2 className="mt-4 mb-2 text-base font-semibold first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...props}>
      {children}
    </h3>
  ),
  h4: ({ node: _node, children, ...props }) => (
    <h4 className="mt-3 mb-1 font-semibold first:mt-0" {...props}>
      {children}
    </h4>
  ),
  p: ({ node: _node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  a: ({ node: _node, children, ...props }) => (
    <a className="text-primary underline underline-offset-2" {...props}>
      {children}
    </a>
  ),
  ul: ({ node: _node, ...props }) => <ul className="my-2 list-disc pl-5" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="my-2 list-decimal pl-5" {...props} />,
  li: ({ node: _node, ...props }) => <li className="my-0.5" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground" {...props} />
  ),
  code: ({ node: _node, ...props }) => (
    <code className="bg-muted px-1 py-0.5 font-mono" {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre className="my-2 overflow-x-auto bg-muted p-3 font-mono [&>code]:p-0" {...props} />
  ),
  hr: () => <Separator className="my-4" />,
};

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
// a card shares.
export function LearningCardDisplay({
  card,
  actions,
  className,
  render,
}: {
  card: Pick<LearningCard, "title" | "description">;
} & Pick<LearningCardFrameProps, "actions" | "className" | "render">) {
  return (
    <LearningCardFrame
      title={<Markdown components={markdownComponents}>{card.title}</Markdown>}
      actions={actions}
      className={className}
      render={render}
    >
      <Markdown components={markdownComponents}>{card.description}</Markdown>
    </LearningCardFrame>
  );
}

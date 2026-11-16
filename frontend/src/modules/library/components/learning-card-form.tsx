import { useForm } from "@tanstack/react-form";
import { Link, type RegisteredRouter, type ValidateLinkOptions } from "@tanstack/react-router";
import { useState, type ComponentProps, type ReactNode } from "react";

import { ApiError } from "@/api/http";
import { useCreateLearningCard, useUpdateLearningCard, type LearningCard } from "@/api/lcards";
import { Button, buttonVariants } from "@/shared/ui/button";
import { FieldError, FieldLabel } from "@/shared/ui/field";
import { Textarea } from "@/shared/ui/textarea";

import { cardErrorMessage } from "./card-error-message";
import { LearningCardFrame, type LearningCardFrameSection } from "./learning-card-frame";
import { LearningCardPreview } from "./learning-card-preview";

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;

// The maxLength attribute counts UTF-16 code units of the raw value, so it
// only caps runaway pastes; validation reports the real limit.
const INPUT_SLACK = 2;

// The server stores fields in this form and checks their length after
// applying it. JS trim() also strips U+FEFF and keeps U+0085, unlike Go's
// strings.TrimSpace; at worst the server rejects what the form accepted.
const canonicalize = (value: string) => value.normalize("NFC").trim();

// Counts code points, as the server does, rather than UTF-16 code units.
const canonicalLength = (value: string) => [...canonicalize(value)].length;

const validateTitle = ({ value }: { value: string }) => {
  const length = canonicalLength(value);
  if (length === 0) {
    return { message: "Title is required" };
  }
  if (length > TITLE_MAX_LENGTH) {
    return { message: `Title must be at most ${TITLE_MAX_LENGTH} characters` };
  }
  return undefined;
};

const validateDescription = ({ value }: { value: string }) => {
  const length = canonicalLength(value);
  if (length === 0) {
    return { message: "Description is required" };
  }
  if (length > DESCRIPTION_MAX_LENGTH) {
    return {
      message: `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
    };
  }
  return undefined;
};

// What the editor's bands need from a form field holding text.
interface TextField {
  name: string;
  state: { value: string; meta: { errors: ({ message: string } | undefined)[] } };
  handleBlur: () => void;
  handleChange: (value: string) => void;
}

// A field as one of the editor's sections: its label and counter in the
// label bar, the field as the content, its error in the status bar.
function fieldSection(
  field: TextField,
  label: string,
  maxLength: number,
  control: Pick<ComponentProps<"textarea">, "className" | "placeholder">,
): LearningCardFrameSection {
  const invalid = field.state.meta.errors.length > 0;
  return {
    label: <FieldLabel htmlFor={field.name}>{label}</FieldLabel>,
    meta: `${canonicalLength(field.state.value)}/${maxLength}`,
    content: (
      <Textarea
        {...control}
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        maxLength={maxLength * INPUT_SLACK}
        aria-invalid={invalid}
      />
    ),
    status: invalid ? <FieldError errors={field.state.meta.errors} /> : null,
    invalid,
  };
}

interface LearningCardFormProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
> {
  card?: LearningCard;
  // Where Cancel goes, which is the page's decision.
  cancel: ValidateLinkOptions<TRouter, TOptions>;
  // Called after a successful save, and awaited; what follows a save, such
  // as leaving the page, is the page's (ADR 0036).
  onSaved?: () => void | Promise<void>;
}

// Creates a card, or updates the given one: the editor, its buttons, and
// a preview of the card. Its page places it and gives it a heading.
export function LearningCardForm<TRouter extends RegisteredRouter, TOptions>(
  props: LearningCardFormProps<TRouter, TOptions>,
): ReactNode;
export function LearningCardForm({ card, cancel, onSaved }: LearningCardFormProps): ReactNode {
  // Retain the version the form opened with across background query refetches.
  const [editingVersion] = useState(card?.version);
  const createLearningCard = useCreateLearningCard();
  const updateLearningCard = useUpdateLearningCard();
  const isEditing = Boolean(card);
  const mutation = isEditing ? updateLearningCard : createLearningCard;

  const form = useForm({
    defaultValues: {
      title: card?.title ?? "",
      description: card?.description ?? "",
    },
    onSubmit: async ({ value, formApi }) => {
      const input = {
        title: canonicalize(value.title),
        description: canonicalize(value.description),
      };
      try {
        if (card) {
          await updateLearningCard.mutateAsync({
            id: card.id,
            version: editingVersion!,
            ...input,
          });
        } else {
          await createLearningCard.mutateAsync(input);
        }
      } catch (error) {
        // The mutation's state shows the failure below the fields, and the
        // form keeps the user's input. An error that isn't an ApiError is a
        // bug behind "Something went wrong", so it goes to the console.
        if (!(error instanceof ApiError)) {
          console.error(error);
        }
        return;
      }
      if (!card) {
        formApi.reset();
      }
      await onSaved?.();
    },
  });

  return (
    <form
      className="grid grid-cols-1 gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // onSubmit handles a failed save itself, and the form's state
        // shows the submission's progress, so the event handler has
        // nothing to wait for.
        void form.handleSubmit();
      }}
    >
      <form.Field name="title" validators={{ onChange: validateTitle, onSubmit: validateTitle }}>
        {(title) => (
          <form.Field
            name="description"
            validators={{ onChange: validateDescription, onSubmit: validateDescription }}
          >
            {(description) => (
              <LearningCardFrame
                strip="Edit"
                title={fieldSection(title, "Title", TITLE_MAX_LENGTH, {
                  className: "min-h-5",
                  placeholder: "Enter title...",
                })}
                description={fieldSection(description, "Description", DESCRIPTION_MAX_LENGTH, {
                  className: "min-h-50",
                  placeholder: "Enter description...",
                })}
              />
            )}
          </form.Field>
        )}
      </form.Field>

      {/* The save error sits left of the buttons, next to the action that
          failed, and adds no row, so nothing above it moves. */}
      <div className="flex items-center justify-end gap-2">
        {mutation.isError && (
          <FieldError className="min-w-0 flex-1">
            {cardErrorMessage(mutation.error, isEditing ? "save your edits" : "create the card")}
          </FieldError>
        )}
        <Link {...cancel} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                  ? "Update Card"
                  : "Create Card"}
            </Button>
          )}
        </form.Subscribe>
      </div>

      <form.Subscribe selector={(state) => state.values}>
        {(values) => <LearningCardPreview card={values} />}
      </form.Subscribe>
    </form>
  );
}

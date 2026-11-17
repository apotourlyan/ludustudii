import { useForm } from "@tanstack/react-form";
import { Link, type RegisteredRouter, type ValidateLinkOptions } from "@tanstack/react-router";
import { cn } from "cn";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";

import { ApiError, type ApiFieldError } from "@/api/http";
import { useCreateLearningCard, useUpdateLearningCard, type LearningCard } from "@/api/lcards";
import { keepServerErrorsOnBlur, placeFieldErrors } from "@/shared/field-errors";
import { Button, buttonVariants } from "@/shared/ui/button";
import { FieldError, FieldLabel } from "@/shared/ui/field";
import { Textarea } from "@/shared/ui/textarea";

import {
  canonicalize,
  canonicalLength,
  CARD_FIELDS,
  CARD_LIMITS,
  validateDescription,
  validateTitle,
  type CardField,
} from "../model/card-fields";
import { cardErrorMessage } from "./card-error-message";
import { cardFieldMessage } from "./card-field-message";
import { LearningCardFrame, type LearningCardFrameSection } from "./learning-card-frame";
import { LearningCardPreview } from "./learning-card-preview";

// From md up, the preview on the left, the editor on the right, and the
// buttons under the editor. Both frames span the seven band rows as
// subgrids, so each row is as tall as the taller of the two sides and the
// bands line up. The rows have no gap: the bands touch, as inside a frame.
// Below md, one column in document order: editor, buttons, preview.
//
// Rows 1-7 are a full frame's bands, in LearningCardFrame's order: strip,
// title label bar, title content, title status bar, description label bar,
// description content (1fr: it takes what is left), description status
// bar. Row 8 holds the buttons.
const GRID =
  "grid grid-cols-1 gap-6 md:grid-cols-2 md:grid-rows-[auto_auto_auto_auto_auto_1fr_auto_auto] md:gap-y-0";
const BAND_ROWS = "md:row-span-7 md:row-start-1 md:grid md:grid-rows-subgrid";
const BUTTON_ROW = "md:col-start-2 md:row-start-8";

// The maxLength attribute counts UTF-16 code units of the raw value, so it
// only caps runaway pastes; validation reports the real limit.
const INPUT_SLACK = 2;

// A field's errors: the code of the form's own check, or the codes the API
// reported for it (its `onServer` error).
type ApiFieldCodes = ApiFieldError["code"] | readonly ApiFieldError["code"][];

// What the editor's bands need from a form field holding text.
interface TextField {
  name: CardField;
  state: { value: string; meta: { errors: readonly (ApiFieldCodes | undefined)[] } };
  handleBlur: () => void;
  handleChange: (value: string) => void;
}

interface FieldSectionOptions extends Pick<
  ComponentProps<"textarea">,
  "className" | "placeholder"
> {
  label: string;
  // The name of the field that has focus, so the section can show it's
  // the one being edited, and how to change it.
  focused: string | null;
  setFocused: (name: string | null) => void;
}

// A field as one of the editor's sections: its label and counter in the
// label bar, the field as the content, its error in the status bar.
function fieldSection(
  field: TextField,
  { label, focused, setFocused, ...control }: FieldSectionOptions,
): LearningCardFrameSection {
  const maxLength = CARD_LIMITS[field.name];
  const errors = field.state.meta.errors.flat().flatMap((code) => {
    const message = code && cardFieldMessage(field.name, code);
    return message ? [{ message }] : [];
  });
  const invalid = field.state.meta.errors.length > 0;
  const length = canonicalLength(field.state.value);
  return {
    label: <FieldLabel htmlFor={field.name}>{label}</FieldLabel>,
    meta: `${length}/${maxLength}`,
    progress: length / maxLength,
    content: (
      <Textarea
        {...control}
        id={field.name}
        name={field.name}
        value={field.state.value}
        onFocus={() => setFocused(field.name)}
        onBlur={() => {
          field.handleBlur();
          setFocused(null);
        }}
        onChange={(e) => field.handleChange(e.target.value)}
        maxLength={maxLength * INPUT_SLACK}
        aria-invalid={invalid}
      />
    ),
    status: invalid ? <FieldError errors={errors} /> : null,
    invalid,
    active: focused === field.name,
  };
}

interface LearningCardFormProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
> {
  card?: LearningCard;
  // Where Cancel goes, which is the page's decision.
  cancel: ValidateLinkOptions<TRouter, TOptions>;
  // Called with the saved card after a successful save, and awaited; what
  // follows a save, such as going to the card's page, is the page's
  // (ADR 0036). Required: the form keeps its values after a save, so a page
  // that stayed on it would let the same card be created twice.
  onSaved: (card: SavedLearningCard) => void | Promise<void>;
}

// A card as the form saved it: its ID and the title and description sent.
// The API answers a create with the new card's ID and an update with no
// body, so the version and timestamps come from the next read.
type SavedLearningCard = Pick<LearningCard, "id" | "title" | "description">;

// Creates a card, or updates the given one: the editor, its buttons, and
// a preview of the card. Its page places it and gives it a heading.
export function LearningCardForm<TRouter extends RegisteredRouter, TOptions>(
  props: LearningCardFormProps<TRouter, TOptions>,
): ReactNode;
export function LearningCardForm({ card, cancel, onSaved }: LearningCardFormProps): ReactNode {
  // Retain the version the form opened with across background query refetches.
  const [editingVersion] = useState(card?.version);
  const [focused, setFocused] = useState<string | null>(null);
  // Whether the last save failed in a way no field shows, so the line next
  // to the buttons has to (ADR 0038: a placeholder until notifications).
  const [saveFailed, setSaveFailed] = useState(false);
  const formElement = useRef<HTMLFormElement>(null);
  const createLearningCard = useCreateLearningCard();
  const updateLearningCard = useUpdateLearningCard();
  const isEditing = Boolean(card);
  const mutation = isEditing ? updateLearningCard : createLearningCard;

  const form = useForm({
    defaultValues: {
      title: card?.title ?? "",
      description: card?.description ?? "",
    },
    validationLogic: keepServerErrorsOnBlur,
    // The form's own checks stopped the submit.
    onSubmitInvalid: () => focusFirstInvalidField(),
    onSubmit: async ({ value }) => {
      setSaveFailed(false);
      const input = {
        title: canonicalize(value.title),
        description: canonicalize(value.description),
      };
      let id: string;
      try {
        if (card) {
          await updateLearningCard.mutateAsync({
            id: card.id,
            version: editingVersion!,
            ...input,
          });
          id = card.id;
        } else {
          ({ id } = await createLearningCard.mutateAsync(input));
        }
      } catch (error) {
        // The form keeps the user's input. What the API says about a field
        // goes on that field; the rest shows below the fields. An error that
        // isn't an ApiError is a bug behind "Something went wrong", so it
        // goes to the console.
        const { fields, leftover } = placeFieldErrors(error, CARD_FIELDS, cardFieldMessage);
        for (const name of CARD_FIELDS) {
          // The server's error, which TanStack Form clears when the field
          // changes (see keepServerErrorsOnBlur).
          form.setFieldMeta(name, (meta) => ({
            ...meta,
            errorMap: { ...meta.errorMap, onServer: fields[name] },
          }));
        }
        if (leftover) {
          setSaveFailed(true);
          if (!(error instanceof ApiError)) {
            console.error(error);
          } else if (error.failure.kind === "http" && error.failure.code === "validation_error") {
            // The API and the form disagree about the contract.
            console.error(
              `${error.message}: the form can't place ${JSON.stringify(error.failure.fieldErrors)}`,
            );
          }
        }
        focusFirstInvalidField();
        return;
      }
      // The form keeps its values after a save: its page leaves it.
      await onSaved({ id, ...input });
    },
  });

  // Moves the focus to the first field, in the form's order, that shows an
  // error, whoever found it (ADR 0038).
  function focusFirstInvalidField() {
    const name = CARD_FIELDS.find((field) => form.getFieldMeta(field)?.errors.length);
    const element = name && formElement.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  }

  return (
    <form
      ref={formElement}
      className={GRID}
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
                className={cn(BAND_ROWS, "md:col-start-2")}
                strip="Edit"
                title={fieldSection(title, {
                  label: "Title",
                  className: "min-h-5",
                  placeholder: "Enter title...",
                  focused,
                  setFocused,
                })}
                description={fieldSection(description, {
                  label: "Description",
                  // Fills its row, so it ends where the preview's description
                  // does when the preview is the taller of the two.
                  className: "h-full min-h-50",
                  placeholder: "Enter description...",
                  focused,
                  setFocused,
                })}
              />
            )}
          </form.Field>
        )}
      </form.Field>

      {/* The save error sits left of the buttons, next to the action that
          failed, and adds no row, so nothing above it moves. */}
      <div className={cn("flex items-center justify-end gap-2 md:mt-4", BUTTON_ROW)}>
        {saveFailed && mutation.isError && (
          <FieldError className="min-w-0 flex-1 animate-in duration-200 fade-in-0 motion-reduce:animate-none">
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
        {(values) => (
          <LearningCardPreview card={values} className={cn(BAND_ROWS, "md:col-start-1")} />
        )}
      </form.Subscribe>
    </form>
  );
}

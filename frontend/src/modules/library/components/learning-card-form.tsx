import { useForm, useSelector } from "@tanstack/react-form";
import { Link, type RegisteredRouter, type ValidateLinkOptions } from "@tanstack/react-router";
import { cn } from "cn";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";

import { ApiError, type ApiFieldError } from "@/api/http";
import { useCreateLearningCard, useUpdateLearningCard, type LearningCard } from "@/api/lcards";
import { keepServerErrorsOnBlur, placeFieldErrors } from "@/shared/field-errors";
import { notifyError } from "@/shared/notify";
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
import { CARD_FIELD_LABELS, cardFieldMessage } from "./card-field-message";
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

// What the editor's bands need from a form field holding text. Its errors
// are codes: its own check's, and the API's from its `onServer` error, which
// TanStack Form flattens into the list.
interface TextField {
  name: CardField;
  state: { value: string; meta: { errors: readonly (ApiFieldError["code"] | undefined)[] } };
  handleBlur: () => void;
  handleChange: (value: string) => void;
}

interface FieldSectionOptions extends Pick<
  ComponentProps<"textarea">,
  "className" | "placeholder"
> {
  // The name of the field that has focus, so the section can show it's
  // the one being edited, and how to change it.
  focused: string | null;
  setFocused: (name: string | null) => void;
}

// A field as one of the editor's sections: its label and counter in the
// label bar, the field as the content, its error in the status bar.
function fieldSection(
  field: TextField,
  { focused, setFocused, ...control }: FieldSectionOptions,
): LearningCardFrameSection {
  const maxLength = CARD_LIMITS[field.name];
  const errors = field.state.meta.errors.flatMap((code) => {
    const message = code && cardFieldMessage(field.name, code);
    return message ? [{ message }] : [];
  });
  const invalid = field.state.meta.errors.length > 0;
  const length = canonicalLength(field.state.value);
  return {
    label: <FieldLabel htmlFor={field.name}>{CARD_FIELD_LABELS[field.name]}</FieldLabel>,
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
// body, so anything else about the card comes from the next read.
type SavedLearningCard = Pick<LearningCard, "id" | "title" | "description">;

// The form's wording for creating a card and for updating one.
const MODE_TEXT = {
  create: {
    action: "create the card",
    submit: "Create Card",
    submitting: "Creating...",
  },
  update: {
    action: "save your edits",
    submit: "Update Card",
    submitting: "Updating...",
  },
} as const;

// Creates a card, or updates the given one: the editor, its buttons, and
// a preview of the card. Its page places it and gives it a heading.
export function LearningCardForm<TRouter extends RegisteredRouter, TOptions>(
  props: LearningCardFormProps<TRouter, TOptions>,
): ReactNode;
export function LearningCardForm({ card, cancel, onSaved }: LearningCardFormProps): ReactNode {
  const [focused, setFocused] = useState<string | null>(null);
  const formElement = useRef<HTMLFormElement>(null);
  // Closes the toast of the last failed save, if any (ADR 0041).
  const dismissSaveError = useRef<(() => void) | undefined>(undefined);
  const createLearningCard = useCreateLearningCard();
  const updateLearningCard = useUpdateLearningCard();
  const mutation = card ? updateLearningCard : createLearningCard;
  const text = MODE_TEXT[card ? "update" : "create"];

  const form = useForm({
    defaultValues: {
      title: card?.title ?? "",
      description: card?.description ?? "",
    },
    validationLogic: keepServerErrorsOnBlur,
    // The form's own checks stopped the submit.
    onSubmitInvalid: () => focusFirstInvalidField(),
    onSubmit: async ({ value }) => {
      // Trying again replaces what the last attempt reported.
      dismissSaveError.current?.();
      dismissSaveError.current = undefined;
      const input = {
        title: canonicalize(value.title),
        description: canonicalize(value.description),
      };
      let id: string;
      try {
        if (card) {
          await updateLearningCard.mutateAsync({ id: card.id, ...input });
          id = card.id;
        } else {
          ({ id } = await createLearningCard.mutateAsync(input));
        }
      } catch (error) {
        // The form keeps the user's input. What the API says about a field
        // goes on that field; the rest is a toast (ADR 0041). An error that
        // isn't an ApiError is a bug behind "Something went wrong", so it
        // goes to the console.
        const { fields, leftover, mismatch, unplaced } = placeFieldErrors(
          error,
          CARD_FIELDS,
          cardFieldMessage,
        );
        for (const name of CARD_FIELDS) {
          // The server's error, which TanStack Form clears when the field
          // changes (see keepServerErrorsOnBlur).
          form.setFieldMeta(name, (meta) => ({
            ...meta,
            errorMap: { ...meta.errorMap, onServer: fields[name] },
          }));
        }
        if (leftover) {
          dismissSaveError.current = notifyError(cardErrorMessage(error, text.action));
          if (!(error instanceof ApiError)) {
            console.error(error);
          } else if (mismatch) {
            // The API and the form disagree about the contract.
            console.error(`${error.message}: the form can't place ${JSON.stringify(unplaced)}`);
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

  // Saving: the form is submitting, or its request is in flight.
  const saving = useSelector(form.store, (state) => state.isSubmitting) || mutation.isPending;
  const submitDisabled = useSelector(form.store, (state) => !state.canSubmit) || saving;
  const submitLabel = saving ? text.submitting : text.submit;

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
                  className: "min-h-5",
                  placeholder: "Enter title...",
                  focused,
                  setFocused,
                })}
                description={fieldSection(description, {
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

      <div className={cn("flex items-center justify-end gap-2 md:mt-4", BUTTON_ROW)}>
        <Link {...cancel} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
        <Button type="submit" disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>

      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <LearningCardPreview card={values} className={cn(BAND_ROWS, "md:col-start-1")} />
        )}
      </form.Subscribe>
    </form>
  );
}

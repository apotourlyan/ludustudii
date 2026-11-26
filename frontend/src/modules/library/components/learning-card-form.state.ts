import { useSelector } from "@tanstack/react-form";
import type { LinkOptions } from "@tanstack/react-router";
import { useRef, useState, type Dispatch, type SetStateAction, type SubmitEvent } from "react";

import { useCreateLearningCard, useUpdateLearningCard, type LearningCard } from "@/api/lcards";
import { keepServerErrorsOnBlur } from "@/shared/lib/keep-server-errors-on-blur";
import { useFormFailure } from "@/shared/lib/use-form-failure";

import {
  canonicalize,
  LEARNING_CARD_FIELDS,
  LEARNING_CARD_LIMITS,
  validateDescription,
  validateTitle,
  type LearningCardField,
} from "../model/learning-card-fields";
import {
  LEARNING_CARD_FORM_TEXT,
  learningCardFieldDisplay,
  learningCardSaveFailure,
  type LearningCardFormMode,
} from "../model/learning-card-form";
import {
  useLearningCardFormInstance,
  type LearningCardFormInstance,
} from "./learning-card-form-hook";

export interface LearningCardFormProps {
  card?: LearningCard;
  // Where Cancel goes, which is the page's decision.
  // Build it with linkOptions(); the prop's type doesn't check the route.
  cancelLink: LinkOptions;
  // Called with the saved card after a successful save, and awaited; what
  // follows a save, such as going to the card's page, is the page's
  // (ADR 0036). Required: the form keeps its values after a save, so a page
  // that stayed on it would let the same card be created twice.
  onSaved: (card: SavedLearningCard) => void | Promise<void>;
}

// A card as the form saved it: its ID and the title and description sent.
// The API answers a create with the new card's ID and an update with no
// body, so anything else about the card comes from the next read.
export type SavedLearningCard = Pick<LearningCard, "id" | "title" | "description">;

// What the form saves to, decided once from its card: a new card, or the
// one it was given.
interface LearningCardSaveTarget {
  mode: LearningCardFormMode;
  // The save's request is in flight.
  saving: boolean;
  // Sends the canonicalized fields and resolves to the saved card's ID.
  save: (input: Omit<SavedLearningCard, "id">) => Promise<string>;
}

// A field's errors as the form library lists them (learningCardFieldDisplay).
type CardFieldCodes = Parameters<typeof learningCardFieldDisplay>[2];

// The maxLength attribute counts UTF-16 code units of the raw value, so it
// only caps runaway pastes; validation reports the real limit.
const INPUT_SLACK = 2;

// What the view binds each field with: its name, its own check, on every
// change and again on submit, and its input's maxLength.
const FIELD_BINDINGS = {
  title: {
    name: "title",
    validators: { onChange: validateTitle, onSubmit: validateTitle },
    maxLength: LEARNING_CARD_LIMITS.title * INPUT_SLACK,
  },
  description: {
    name: "description",
    validators: { onChange: validateDescription, onSubmit: validateDescription },
    maxLength: LEARNING_CARD_LIMITS.description * INPUT_SLACK,
  },
} as const satisfies Record<
  LearningCardField,
  { name: LearningCardField; validators: object; maxLength: number }
>;

// The errors of a field without any. One array for all, so a selector that
// returns it returns the same value each time.
const NO_CODES: CardFieldCodes = [];

// The field being edited, if any, as useState holds it.
type FieldFocus = [LearningCardField | null, Dispatch<SetStateAction<LearningCardField | null>>];

// A field's props for the view: its value, what its bands show, from its
// value and errors, which it reads from the form's store, and what the view
// binds it with.
function useFieldProps(
  form: LearningCardFormInstance,
  name: LearningCardField,
  [focused, setFocused]: FieldFocus,
) {
  const value = useSelector(form.store, (state) => state.values[name]);
  const codes = useSelector(form.store, (state) => state.fieldMeta[name]?.errors ?? NO_CODES);
  return {
    value,
    ...learningCardFieldDisplay(name, value, codes),
    ...FIELD_BINDINGS[name],
    active: focused === name,
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  };
}

// The card form's state and its save workflow: the form and its fields,
// what it saves to, which field is being edited, and what a save does on
// success and failure. Returns what LearningCardFormView renders.
export function useLearningCardForm({ card, cancelLink, onSaved }: LearningCardFormProps) {
  const focus = useState<LearningCardField | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const createLearningCard = useCreateLearningCard();
  const updateLearningCard = useUpdateLearningCard();
  const target: LearningCardSaveTarget = card
    ? {
        mode: "update",
        saving: updateLearningCard.isPending,
        save: async (input) => {
          await updateLearningCard.mutateAsync({ id: card.id, ...input });
          return card.id;
        },
      }
    : {
        mode: "create",
        saving: createLearningCard.isPending,
        save: async (input) => (await createLearningCard.mutateAsync(input)).id,
      };
  const text = LEARNING_CARD_FORM_TEXT[target.mode];

  const form = useLearningCardFormInstance({
    defaultValues: {
      title: card?.title ?? "",
      description: card?.description ?? "",
    },
    validationLogic: keepServerErrorsOnBlur,
    // The form's own checks stopped the submit.
    onSubmitInvalid: () => saveFailure.focusFirstInvalid(),
    onSubmit: ({ value }) => save(value),
  });
  // What a failed save reports: field errors, the toast and the log.
  const saveFailure = useFormFailure(form, LEARNING_CARD_FIELDS, formRef);

  // Saves the card: creates it, or updates the given one, with its fields
  // canonicalized as the server stores them, then hands it to onSaved.
  async function save(value: { title: string; description: string }) {
    // Trying again replaces what the last attempt reported.
    saveFailure.clear();
    const input = {
      title: canonicalize(value.title),
      description: canonicalize(value.description),
    };
    let id: string;
    try {
      id = await target.save(input);
    } catch (error) {
      // What the API says about a field goes on that field; the rest is a
      // toast, and a bug or a contract mismatch is logged
      // (model/learning-card-form.ts).
      saveFailure.report(learningCardSaveFailure(error, target.mode));
      return;
    }
    // The form keeps its values after a save: its page leaves it.
    await onSaved({ id, ...input });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    // The form's onSubmit handles a failed save itself, and the form's
    // state shows the submission's progress, so the event handler has
    // nothing to wait for.
    void form.handleSubmit();
  }

  // Saving: the form is submitting, or its request is in flight.
  const saving = useSelector(form.store, (state) => state.isSubmitting) || target.saving;
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const title = useFieldProps(form, "title", focus);
  const description = useFieldProps(form, "description", focus);

  return {
    form,
    formRef,
    onSubmit: handleSubmit,
    title,
    description,
    // The card as the form's values would save it, following every
    // keystroke in either field.
    preview: { title: title.value, description: description.value },
    cancelLink,
    submitLabel: saving ? text.submitting : text.submit,
    submitDisabled: !canSubmit || saving,
  };
}

export type LearningCardFormState = ReturnType<typeof useLearningCardForm>;

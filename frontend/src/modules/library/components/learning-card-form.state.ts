import { useStore } from "@tanstack/react-form";
import type { RegisteredRouter, ValidateLinkOptions } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";

import { useCreateLearningCard, useUpdateLearningCard, type LearningCard } from "@/api/lcards";
import { keepServerErrorsOnBlur } from "@/shared/keep-server-errors-on-blur";
import { notifyError } from "@/shared/notify";

import {
  canonicalize,
  CARD_FIELDS,
  CARD_LIMITS,
  validateDescription,
  validateTitle,
  type CardField,
} from "../model/card-fields";
import { CARD_FORM_TEXT, cardFieldDisplay, cardSaveFailure } from "../model/card-form";
import { useCardForm } from "./use-card-form";

export interface LearningCardFormProps<
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
export type SavedLearningCard = Pick<LearningCard, "id" | "title" | "description">;

// A field's errors as the form library lists them (cardFieldDisplay).
type CardFieldCodes = Parameters<typeof cardFieldDisplay>[2];

// The maxLength attribute counts UTF-16 code units of the raw value, so it
// only caps runaway pastes; validation reports the real limit.
const INPUT_SLACK = 2;

// Each field's own check, on every change and again on submit.
const FIELD_VALIDATORS = {
  title: { onChange: validateTitle, onSubmit: validateTitle },
  description: { onChange: validateDescription, onSubmit: validateDescription },
} as const satisfies Record<CardField, object>;

// The card form's state and its save workflow: the form and its fields,
// the mutation for its mode, which field is being edited, and what a
// save does on success and failure. Returns what LearningCardFormView
// renders.
export function useLearningCardForm({ card, cancel, onSaved }: LearningCardFormProps) {
  const [focused, setFocused] = useState<CardField | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Closes the toast of the last failed save, if any (ADR 0041).
  const dismissSaveError = useRef<(() => void) | undefined>(undefined);
  const createLearningCard = useCreateLearningCard();
  const updateLearningCard = useUpdateLearningCard();
  const mode = card ? "update" : "create";
  const mutation = card ? updateLearningCard : createLearningCard;
  const text = CARD_FORM_TEXT[mode];

  const form = useCardForm({
    defaultValues: {
      title: card?.title ?? "",
      description: card?.description ?? "",
    },
    validationLogic: keepServerErrorsOnBlur,
    // The form's own checks stopped the submit.
    onSubmitInvalid: () => focusFirstInvalidField(),
    onSubmit: ({ value }) => save(value),
  });

  // Saves the card: creates it, or updates the given one, with its fields
  // canonicalized as the server stores them, then hands it to onSaved.
  async function save(value: { title: string; description: string }) {
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
      reportFailure(error);
      return;
    }
    // The form keeps its values after a save: its page leaves it.
    await onSaved({ id, ...input });
  }

  // What the API says about a field goes on that field; the rest is a
  // toast, and a bug or a contract mismatch is logged (model/card-form.ts).
  function reportFailure(error: unknown) {
    const failure = cardSaveFailure(error, mode);
    for (const name of CARD_FIELDS) {
      // The server's error, which TanStack Form clears when the field
      // changes (see keepServerErrorsOnBlur).
      form.setFieldMeta(name, (meta) => ({
        ...meta,
        errorMap: { ...meta.errorMap, onServer: failure.fields[name] },
      }));
    }
    if (failure.notice !== undefined) {
      dismissSaveError.current = notifyError(failure.notice);
    }
    if (failure.log.length > 0) {
      console.error(...failure.log);
    }
    focusFirstInvalidField();
  }

  // Moves the focus to the first field, in the form's order, that shows an
  // error, whoever found it (ADR 0038).
  function focusFirstInvalidField() {
    const name = CARD_FIELDS.find((field) => form.getFieldMeta(field)?.errors.length);
    const element = name && formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    // onSubmit handles a failed save itself, and the form's state shows
    // the submission's progress, so the event handler has nothing to wait
    // for.
    void form.handleSubmit();
  }

  const values = useStore(form.store, (state) => state.values);
  const titleCodes = useStore(form.store, (state) => state.fieldMeta.title?.errors);
  const descriptionCodes = useStore(form.store, (state) => state.fieldMeta.description?.errors);

  // What a field's bands show, and what the view binds it with. A field's
  // meta exists once it is mounted; until then it has no errors.
  function fieldProps(name: CardField, codes: CardFieldCodes = []) {
    return {
      ...cardFieldDisplay(name, values[name], codes),
      name,
      validators: FIELD_VALIDATORS[name],
      maxLength: CARD_LIMITS[name] * INPUT_SLACK,
      active: focused === name,
      onFocus: () => setFocused(name),
      onBlur: () => setFocused(null),
    };
  }

  // Saving: the form is submitting, or its request is in flight.
  const saving = useStore(form.store, (state) => state.isSubmitting) || mutation.isPending;
  const canSubmit = useStore(form.store, (state) => state.canSubmit);

  return {
    form,
    formRef,
    onSubmit,
    title: fieldProps("title", titleCodes),
    description: fieldProps("description", descriptionCodes),
    cancel,
    submitLabel: saving ? text.submitting : text.submit,
    submitDisabled: !canSubmit || saving,
  };
}

export type LearningCardFormState = ReturnType<typeof useLearningCardForm>;

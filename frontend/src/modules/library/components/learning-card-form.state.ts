import { useSelector } from "@tanstack/react-form";
import type { LinkOptions } from "@tanstack/react-router";
import { useRef, useState, type SubmitEvent } from "react";

import { useCreateLearningCard, useUpdateLearningCard, type LearningCard } from "@/api/lcards";
import { keepServerErrorsOnBlur } from "@/shared/keep-server-errors-on-blur";
import { useErrorToast } from "@/shared/use-error-toast";

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
import { useLearningCardAppForm } from "./use-learning-card-app-form";

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

// Each field's own check, on every change and again on submit.
const FIELD_VALIDATORS = {
  title: { onChange: validateTitle, onSubmit: validateTitle },
  description: { onChange: validateDescription, onSubmit: validateDescription },
} as const satisfies Record<LearningCardField, object>;

// The card form's state and its save workflow: the form and its fields,
// what it saves to, which field is being edited, and what a save does on
// success and failure. Returns what LearningCardFormView renders.
export function useLearningCardForm({ card, cancelLink, onSaved }: LearningCardFormProps) {
  const [focused, setFocused] = useState<LearningCardField | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The toast of the last failed save, if any (ADR 0041).
  const saveError = useErrorToast();
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

  const form = useLearningCardAppForm({
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
    saveError.clear();
    const input = {
      title: canonicalize(value.title),
      description: canonicalize(value.description),
    };
    let id: string;
    try {
      id = await target.save(input);
    } catch (error) {
      reportFailure(error);
      return;
    }
    // The form keeps its values after a save: its page leaves it.
    await onSaved({ id, ...input });
  }

  // What the API says about a field goes on that field; the rest is a
  // toast, and a bug or a contract mismatch is logged
  // (model/learning-card-form.ts).
  function reportFailure(error: unknown) {
    const failure = learningCardSaveFailure(error, target.mode);
    for (const name of LEARNING_CARD_FIELDS) {
      // The server's error, which TanStack Form clears when the field
      // changes (see keepServerErrorsOnBlur).
      form.setFieldMeta(name, (meta) => ({
        ...meta,
        errorMap: { ...meta.errorMap, onServer: failure.fields[name] },
      }));
    }
    if (failure.notice !== undefined) {
      saveError.show(failure.notice);
    }
    if (failure.log.length > 0) {
      console.error(...failure.log);
    }
    focusFirstInvalidField();
  }

  // Moves the focus to the first field, in the form's order, that shows an
  // error, whoever found it (ADR 0038).
  function focusFirstInvalidField() {
    const name = LEARNING_CARD_FIELDS.find((field) => form.getFieldMeta(field)?.errors.length);
    const element = name && formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    // The form's onSubmit handles a failed save itself, and the form's
    // state shows the submission's progress, so the event handler has
    // nothing to wait for.
    void form.handleSubmit();
  }

  // Each field's value and errors, for its counter and status bar. A
  // field's meta exists once it is mounted; until then it has no errors.
  const titleValue = useSelector(form.store, (state) => state.values.title);
  const titleCodes = useSelector(form.store, (state) => state.fieldMeta.title?.errors);
  const descriptionValue = useSelector(form.store, (state) => state.values.description);
  const descriptionCodes = useSelector(form.store, (state) => state.fieldMeta.description?.errors);

  // What a field's bands show, and what the view binds it with.
  function fieldProps(name: LearningCardField, value: string, codes: CardFieldCodes = []) {
    return {
      ...learningCardFieldDisplay(name, value, codes),
      name,
      validators: FIELD_VALIDATORS[name],
      maxLength: LEARNING_CARD_LIMITS[name] * INPUT_SLACK,
      active: focused === name,
      onFocus: () => setFocused(name),
      onBlur: () => setFocused(null),
    };
  }

  // Saving: the form is submitting, or its request is in flight.
  const saving = useSelector(form.store, (state) => state.isSubmitting) || target.saving;
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);

  return {
    form,
    formRef,
    onSubmit: handleSubmit,
    title: fieldProps("title", titleValue, titleCodes),
    description: fieldProps("description", descriptionValue, descriptionCodes),
    cancelLink,
    submitLabel: saving ? text.submitting : text.submit,
    submitDisabled: !canSubmit || saving,
  };
}

export type LearningCardFormState = ReturnType<typeof useLearningCardForm>;

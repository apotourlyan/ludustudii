// The card form beyond its fields' checks (learning-card-fields.ts): its
// wording in each mode, what each field's bands show, and what a failed save
// means (ADR 0038, 0041). The form's state hook applies these. Nothing here,
// nor anything it imports, loads React or the form library:
// placeFieldErrors lives apart from keepServerErrorsOnBlur for that, and
// useFormFailure's FormFailure is a type import.

import type { ApiFieldError } from "@/api/http";
import { placeFieldErrors } from "@/shared/field-errors";
import type { FormFailure } from "@/shared/use-form-failure";

import { learningCardErrorMessage } from "./learning-card-error-message";
import {
  LEARNING_CARD_FIELD_LABELS,
  learningCardFieldMessage,
} from "./learning-card-field-message";
import {
  LEARNING_CARD_FIELDS,
  LEARNING_CARD_LIMITS,
  canonicalLength,
  type LearningCardField,
} from "./learning-card-fields";

type FieldCode = ApiFieldError["code"];

// The form creates a card, or updates the one it was given.
export type LearningCardFormMode = "create" | "update";

// The form's wording in each mode: the action, phrased to follow "trying
// to" in a failure's message, and the submit button's label at rest and
// while saving.
export const LEARNING_CARD_FORM_TEXT = {
  create: {
    action: "create the card",
    submit: "Create card",
    submitting: "Creating...",
  },
  update: {
    action: "save your edits",
    submit: "Update card",
    submitting: "Updating...",
  },
} as const satisfies Record<
  LearningCardFormMode,
  { action: string; submit: string; submitting: string }
>;

// What a field's label bar and status bar show.
export interface LearningCardFieldDisplay {
  label: string;
  // The counter: the value's length as the API counts it, of the limit.
  meta: string;
  // How far the length is toward the limit, from 0, and past 1 over it.
  progress: number;
  // The text of each error code the module has wording for, for the
  // status bar.
  errors: { message: string }[];
  // The field has errors, whether or not each has wording.
  invalid: boolean;
}

// The bands of `field` holding `value`, with the error codes the form
// reports for it: its own check's and the API's. The form library lists
// a field's errors with undefined for a validator that found none.
export function learningCardFieldDisplay(
  field: LearningCardField,
  value: string,
  codes: readonly (FieldCode | undefined)[],
): LearningCardFieldDisplay {
  const limit = LEARNING_CARD_LIMITS[field];
  const length = canonicalLength(value);
  return {
    label: LEARNING_CARD_FIELD_LABELS[field],
    meta: `${length}/${limit}`,
    progress: length / limit,
    errors: codes.flatMap((code) => {
      const message = code && learningCardFieldMessage(field, code);
      return message ? [{ message }] : [];
    }),
    invalid: codes.length > 0,
  };
}

// What the form does with a failed save; useFormFailure applies it.
export type LearningCardSaveFailure = FormFailure<LearningCardField>;

export function learningCardSaveFailure(
  error: unknown,
  mode: LearningCardFormMode,
): LearningCardSaveFailure {
  const placed = placeFieldErrors(error, LEARNING_CARD_FIELDS, learningCardFieldMessage);
  return {
    fields: placed.fields,
    notice: placed.leftover
      ? learningCardErrorMessage(error, LEARNING_CARD_FORM_TEXT[mode].action)
      : undefined,
    log: failureLog(error, placed),
  };
}

function failureLog(
  error: unknown,
  { unexpected, mismatch, unplaced }: ReturnType<typeof placeFieldErrors>,
): readonly unknown[] {
  if (unexpected) {
    return [error];
  }
  if (mismatch) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${message}: the form can't place ${JSON.stringify(unplaced)}`];
  }
  return [];
}

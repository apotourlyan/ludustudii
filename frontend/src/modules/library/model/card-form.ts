// The card form beyond its fields' checks (card-fields.ts): its wording in
// each mode, what each field's bands show, and what a failed save means
// (ADR 0038, 0041). The form's state hook applies these. Nothing here, nor
// anything it imports, loads React or the form library: placeFieldErrors
// lives apart from keepServerErrorsOnBlur for that.

import type { ApiFieldError } from "@/api/http";
import { placeFieldErrors } from "@/shared/field-errors";

import { cardErrorMessage } from "./card-error-message";
import { CARD_FIELD_LABELS, cardFieldMessage } from "./card-field-message";
import { CARD_FIELDS, CARD_LIMITS, canonicalLength, type CardField } from "./card-fields";

type FieldCode = ApiFieldError["code"];

// The form creates a card, or updates the one it was given.
export type CardFormMode = "create" | "update";

// The form's wording in each mode: the action, phrased to follow "trying
// to" in a failure's message, and the submit button's label at rest and
// while saving.
export const CARD_FORM_TEXT = {
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
} as const satisfies Record<CardFormMode, { action: string; submit: string; submitting: string }>;

// What a field's label bar and status bar show.
export interface CardFieldDisplay {
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
export function cardFieldDisplay(
  field: CardField,
  value: string,
  codes: readonly (FieldCode | undefined)[],
): CardFieldDisplay {
  const limit = CARD_LIMITS[field];
  const length = canonicalLength(value);
  return {
    label: CARD_FIELD_LABELS[field],
    meta: `${length}/${limit}`,
    progress: length / limit,
    errors: codes.flatMap((code) => {
      const message = code && cardFieldMessage(field, code);
      return message ? [{ message }] : [];
    }),
    invalid: codes.length > 0,
  };
}

// What the form does with a failed save. The form keeps the user's input.
export interface CardSaveFailure {
  // The API's codes for each field it reported, to show on that field. A
  // field without any is absent, which clears what it showed.
  fields: Readonly<Partial<Record<CardField, readonly FieldCode[]>>>;
  // The toast for what no field shows (ADR 0041), or undefined when the
  // fields show it all.
  notice: string | undefined;
  // What to log to the console for developers, as console.error's
  // arguments; empty for nothing: an error that isn't an API failure is a
  // bug, and field errors the form can't place mean the API and the form
  // disagree about the contract.
  log: readonly unknown[];
}

export function cardSaveFailure(error: unknown, mode: CardFormMode): CardSaveFailure {
  const placed = placeFieldErrors(error, CARD_FIELDS, cardFieldMessage);
  return {
    fields: placed.fields,
    notice: placed.leftover ? cardErrorMessage(error, CARD_FORM_TEXT[mode].action) : undefined,
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

import { ApiError, type ApiFieldError } from "@/api/http";

type FieldCode = ApiFieldError["code"];

// What a form can show of an API failure (ADR 0038).
export interface PlacedFieldErrors<Field extends string> {
  // The codes the API reported per form field, only those the form's
  // wording has text for. A field the API didn't report is absent.
  readonly fields: Readonly<Partial<Record<Field, readonly FieldCode[]>>>;
  // True when something stays that no field shows: the failure isn't a
  // validation error, or it has no field errors, or one names a field the
  // form doesn't have or a code its wording doesn't know.
  readonly leftover: boolean;
  // True for a validation error the form can't fully place: one without
  // field errors, or with some in `unplaced`. The API and the form disagree
  // about the contract, which the form logs with the request ID.
  readonly mismatch: boolean;
  // The validation error's field errors the form can't place.
  readonly unplaced: readonly ApiFieldError[];
  // True when the error isn't an ApiError at all: not a failed request but
  // a bug behind it, which the form logs.
  readonly unexpected: boolean;
}

// Splits a failed request's field errors into those the form can show on
// its fields and the rest. A field error is matched by name and code:
// `fields` are the form's field names, `wording` returns undefined for a
// field and code it has no text for, and `apiNames` maps the API's names to
// the form's for a form that names a field differently. Knows nothing of
// any form beyond what it's given.
export function placeFieldErrors<Field extends string>(
  error: unknown,
  fields: readonly Field[],
  wording: (field: Field, code: FieldCode) => string | undefined,
  apiNames: Readonly<Record<string, Field>> = {},
): PlacedFieldErrors<Field> {
  const placed: Partial<Record<Field, FieldCode[]>> = {};
  if (!(error instanceof ApiError)) {
    return { fields: placed, leftover: true, mismatch: false, unplaced: [], unexpected: true };
  }
  if (error.failure.kind !== "http" || error.failure.code !== "validation_error") {
    return { fields: placed, leftover: true, mismatch: false, unplaced: [], unexpected: false };
  }
  const unplaced: ApiFieldError[] = [];
  for (const fieldError of error.failure.fieldErrors) {
    const { field: apiName, code } = fieldError;
    const name = Object.hasOwn(apiNames, apiName)
      ? apiNames[apiName]
      : fields.find((field) => field === apiName);
    if (name === undefined || wording(name, code) === undefined) {
      unplaced.push(fieldError);
      continue;
    }
    (placed[name] ??= []).push(code);
  }
  const mismatch = error.failure.fieldErrors.length === 0 || unplaced.length > 0;
  return { fields: placed, leftover: mismatch, mismatch, unplaced, unexpected: false };
}

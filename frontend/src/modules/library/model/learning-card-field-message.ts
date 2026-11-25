import type { ApiFieldError } from "@/api/http";

import { LEARNING_CARD_LIMITS, type LearningCardField } from "./learning-card-fields";

// A card field's label, on the field and in its messages.
export const LEARNING_CARD_FIELD_LABELS = {
  title: "Title",
  description: "Description",
} as const satisfies Record<LearningCardField, string>;

// The text for a card field's error code, whether the form's own check or
// the API found it (ADR 0038), or undefined for a pair this module has no
// wording for.
export function learningCardFieldMessage(
  field: LearningCardField,
  code: ApiFieldError["code"],
): string | undefined {
  switch (code) {
    case "required":
      return `${LEARNING_CARD_FIELD_LABELS[field]} is required`;
    case "max_length":
      return `${LEARNING_CARD_FIELD_LABELS[field]} must be at most ${LEARNING_CARD_LIMITS[field]} characters`;
    default:
      return undefined;
  }
}

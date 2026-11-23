import type { ApiFieldError } from "@/api/http";

import { CARD_LIMITS, type CardField } from "./card-fields";

// A card field's label, on the field and in its messages.
export const CARD_FIELD_LABELS = {
  title: "Title",
  description: "Description",
} as const satisfies Record<CardField, string>;

// The text for a card field's error code, whether the form's own check or
// the API found it (ADR 0038), or undefined for a pair this module has no
// wording for.
export function cardFieldMessage(
  field: CardField,
  code: ApiFieldError["code"],
): string | undefined {
  switch (code) {
    case "required":
      return `${CARD_FIELD_LABELS[field]} is required`;
    case "max_length":
      return `${CARD_FIELD_LABELS[field]} must be at most ${CARD_LIMITS[field]} characters`;
    default:
      return undefined;
  }
}

// The card form's fields: their limits, how their text is canonicalized and
// checked. Checks return the API's field codes, never text; the wording is
// chosen from a field and a code in card-field-message.ts
// (ADR 0038).

import type { ApiFieldError } from "@/api/http";

export const CARD_FIELDS = ["title", "description"] as const;
export type CardField = (typeof CARD_FIELDS)[number];

// The limits the API enforces, in characters (code points) after
// canonicalization.
export const CARD_LIMITS = {
  title: 200,
  description: 2000,
} as const satisfies Record<CardField, number>;

// The codes the form's own checks can return.
export type CardFieldCode = Extract<ApiFieldError["code"], "required" | "max_length">;

// The server stores fields in this form and checks their length after
// applying it. JS trim() also strips U+FEFF and keeps U+0085, unlike Go's
// strings.TrimSpace; at worst the server rejects what the form accepted.
export const canonicalize = (value: string) => value.normalize("NFC").trim();

// Counts code points, as the server does, rather than UTF-16 code units.
export const canonicalLength = (value: string) => [...canonicalize(value)].length;

function checkField(field: CardField): (props: { value: string }) => CardFieldCode | undefined {
  return ({ value }) => {
    const length = canonicalLength(value);
    if (length === 0) {
      return "required";
    }
    return length > CARD_LIMITS[field] ? "max_length" : undefined;
  };
}

export const validateTitle = checkField("title");
export const validateDescription = checkField("description");

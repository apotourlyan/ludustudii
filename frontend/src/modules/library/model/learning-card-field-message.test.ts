import { expect, test } from "vitest";

import type { ApiFieldError } from "@/api/http";

import { CARD_FIELD_LABELS, cardFieldMessage } from "./learning-card-field-message";

test("labels the fields", () => {
  expect(CARD_FIELD_LABELS).toEqual({ title: "Title", description: "Description" });
});

test.each([
  { field: "title", code: "required", message: "Title is required" },
  { field: "description", code: "required", message: "Description is required" },
  { field: "title", code: "max_length", message: "Title must be at most 200 characters" },
  {
    field: "description",
    code: "max_length",
    message: "Description must be at most 2000 characters",
  },
] as const)("words $code on the $field", ({ field, code, message }) => {
  expect(cardFieldMessage(field, code)).toBe(message);
});

// Codes the card fields don't get; the form treats them as a mismatch.
test.each([
  "invalid_uuid7",
  "invalid_cursor",
  "untrimmed",
  "not_normalized",
  "invalid_integer",
  "out_of_range",
] satisfies ApiFieldError["code"][])("has no wording for %s", (code) => {
  expect(cardFieldMessage("title", code)).toBeUndefined();
  expect(cardFieldMessage("description", code)).toBeUndefined();
});

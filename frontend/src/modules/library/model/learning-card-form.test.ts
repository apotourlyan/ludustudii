import { describe, expect, test } from "vitest";

import { ApiError, type ApiFieldError } from "@/api/http";

import {
  LEARNING_CARD_FORM_TEXT,
  learningCardFieldDisplay,
  learningCardSaveFailure,
} from "./learning-card-form";

const NETWORK = "Can't reach the server. Check your connection and try again.";

const validationError = (fieldErrors: ApiFieldError[]) =>
  new ApiError({
    kind: "http",
    status: 400,
    code: "validation_error",
    fieldErrors,
    requestId: "req-1",
  });

test("words each mode", () => {
  expect(LEARNING_CARD_FORM_TEXT).toEqual({
    create: { action: "create the card", submit: "Create card", submitting: "Creating..." },
    edit: { action: "save your edits", submit: "Save card", submitting: "Saving..." },
  });
});

describe("learningCardFieldDisplay", () => {
  test("labels the field and counts its value against the limit", () => {
    expect(learningCardFieldDisplay("title", "Photosynthesis", [])).toEqual({
      label: "Title",
      meta: "14/200",
      progress: 14 / 200,
      errors: [],
      invalid: false,
    });
    expect(learningCardFieldDisplay("description", "", []).meta).toBe("0/2000");
  });

  test("counts as the API does: after canonicalizing, in code points", () => {
    expect(learningCardFieldDisplay("title", "  \u{1F600}é  ", []).meta).toBe("2/200");
  });

  test("goes past the limit when the value does", () => {
    const display = learningCardFieldDisplay("title", "a".repeat(250), []);

    expect(display.meta).toBe("250/200");
    expect(display.progress).toBe(1.25);
  });

  test("words each error code and marks the field invalid", () => {
    const display = learningCardFieldDisplay("description", "", ["required", "max_length"]);

    expect(display.errors).toEqual([
      { message: "Description is required" },
      { message: "Description must be at most 2000 characters" },
    ]);
    expect(display.invalid).toBe(true);
  });

  test("skips the slots of validators that found nothing", () => {
    const display = learningCardFieldDisplay("title", "", [undefined, "required"]);

    expect(display.errors).toEqual([{ message: "Title is required" }]);
    expect(display.invalid).toBe(true);
  });

  // A code the module has no wording for still marks the field.
  test("marks a field invalid for a code without wording, showing no text", () => {
    const display = learningCardFieldDisplay("title", "a", ["untrimmed"]);

    expect(display.errors).toEqual([]);
    expect(display.invalid).toBe(true);
  });
});

describe("learningCardSaveFailure", () => {
  test("puts field errors the form can place on their fields, with no toast or log", () => {
    const failure = learningCardSaveFailure(
      validationError([
        { field: "title", code: "max_length" },
        { field: "description", code: "required" },
      ]),
      "create",
    );

    expect(failure).toEqual({
      fields: { title: ["max_length"], description: ["required"] },
      notice: undefined,
      log: [],
    });
  });

  test("toasts and logs field errors the form can't place, and places the rest", () => {
    const failure = learningCardSaveFailure(
      validationError([
        { field: "title", code: "required" },
        { field: "tags", code: "required" },
      ]),
      "edit",
    );

    expect(failure.fields).toEqual({ title: ["required"] });
    expect(failure.notice).toBe("Something went wrong while trying to save your edits.");
    expect(failure.log).toEqual([
      'HTTP 400 validation_error (request req-1): the form can\'t place [{"field":"tags","code":"required"}]',
    ]);
  });

  test("toasts a network failure without logging it", () => {
    expect(learningCardSaveFailure(new ApiError({ kind: "network" }), "create")).toEqual({
      fields: {},
      notice: NETWORK,
      log: [],
    });
  });

  test("toasts a missing card in the card's words", () => {
    const missing = new ApiError({
      kind: "http",
      status: 404,
      code: "not_found",
      fieldErrors: [],
      requestId: "req-1",
    });

    expect(learningCardSaveFailure(missing, "edit")).toEqual({
      fields: {},
      notice: "This card doesn't exist. It may have been deleted.",
      log: [],
    });
  });

  test.each([
    { mode: "create", action: "create the card" },
    { mode: "edit", action: "save your edits" },
  ] as const)("toasts a server error with the $mode action", ({ mode, action }) => {
    const serverError = new ApiError({
      kind: "http",
      status: 500,
      code: "unexpected_error",
      fieldErrors: [],
      requestId: "req-1",
    });

    expect(learningCardSaveFailure(serverError, mode).notice).toBe(
      `Something went wrong while trying to ${action}.`,
    );
    expect(learningCardSaveFailure(serverError, mode).log).toEqual([]);
  });

  test("toasts and logs an error that isn't an API failure, as a bug", () => {
    const bug = new TypeError("x is undefined");

    expect(learningCardSaveFailure(bug, "create")).toEqual({
      fields: {},
      notice: "Something went wrong while trying to create the card.",
      log: [bug],
    });
  });
});

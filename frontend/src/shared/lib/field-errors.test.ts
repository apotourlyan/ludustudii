import { describe, expect, test } from "vitest";

import { ApiError, type ApiFieldError } from "@/api/http";

import { placeFieldErrors } from "./field-errors";

const FIELDS = ["title", "description"] as const;
type Field = (typeof FIELDS)[number];

// The form's wording: text for required and max_length on either field.
const wording = (_field: Field, code: ApiFieldError["code"]) =>
  code === "required" || code === "max_length" ? code : undefined;

const validationError = (fieldErrors: ApiFieldError[]) =>
  new ApiError({
    kind: "http",
    status: 400,
    code: "validation_error",
    fieldErrors,
    requestId: "req-1",
  });

const place = (error: unknown, apiNames?: Record<string, Field>) =>
  placeFieldErrors(error, FIELDS, wording, apiNames);

describe("a validation error", () => {
  test("whose field errors all match goes on the fields and leaves nothing over", () => {
    const placed = place(
      validationError([
        { field: "title", code: "required" },
        { field: "description", code: "max_length" },
      ]),
    );

    expect(placed).toEqual({
      fields: { title: ["required"], description: ["max_length"] },
      leftover: false,
      mismatch: false,
      unplaced: [],
      unexpected: false,
    });
  });

  test("keeps every code of one field, in the API's order", () => {
    const placed = place(
      validationError([
        { field: "title", code: "max_length" },
        { field: "title", code: "required" },
      ]),
    );

    expect(placed.fields).toEqual({ title: ["max_length", "required"] });
    expect(placed.leftover).toBe(false);
  });

  test("leaves a field the API didn't report absent", () => {
    const placed = place(validationError([{ field: "title", code: "required" }]));

    expect(placed.fields).not.toHaveProperty("description");
  });

  test.each([
    { why: "a field the form doesn't have", fieldError: { field: "tags", code: "required" } },
    {
      why: "a code the wording has no text for",
      fieldError: { field: "title", code: "untrimmed" },
    },
    { why: "a name that differs in case", fieldError: { field: "Title", code: "required" } },
  ] satisfies { why: string; fieldError: ApiFieldError }[])(
    "with $why places the rest and reports a mismatch",
    ({ fieldError }) => {
      const placed = place(
        validationError([{ field: "description", code: "required" }, fieldError]),
      );

      expect(placed).toEqual({
        fields: { description: ["required"] },
        leftover: true,
        mismatch: true,
        unplaced: [fieldError],
        unexpected: false,
      });
    },
  );

  test("without field errors places nothing and reports a mismatch", () => {
    expect(place(validationError([]))).toEqual({
      fields: {},
      leftover: true,
      mismatch: true,
      unplaced: [],
      unexpected: false,
    });
  });

  test("maps the API's names to the form's", () => {
    const placed = place(validationError([{ field: "name", code: "required" }]), { name: "title" });

    expect(placed.fields).toEqual({ title: ["required"] });
    expect(placed.leftover).toBe(false);
  });

  test("maps only the names given, not those every object has", () => {
    const fieldError = { field: "toString", code: "required" } satisfies ApiFieldError;

    expect(place(validationError([fieldError]), {}).unplaced).toEqual([fieldError]);
  });
});

describe("a failure that isn't a validation error", () => {
  test.each([
    { why: "a network failure", error: new ApiError({ kind: "network" }) },
    {
      why: "a 404",
      error: new ApiError({
        kind: "http",
        status: 404,
        code: "not_found",
        fieldErrors: [],
        requestId: "req-1",
      }),
    },
    {
      why: "a 400 with another code, field errors and all",
      error: new ApiError({
        kind: "http",
        status: 400,
        code: "bind_error",
        fieldErrors: [{ field: "title", code: "required" }],
        requestId: "req-1",
      }),
    },
    {
      why: "a 400 whose body isn't the API's error shape",
      error: new ApiError({
        kind: "http",
        status: 400,
        code: undefined,
        fieldErrors: [],
        requestId: undefined,
      }),
    },
  ])("($why) is all left over, without a mismatch", ({ error }) => {
    expect(place(error)).toEqual({
      fields: {},
      leftover: true,
      mismatch: false,
      unplaced: [],
      unexpected: false,
    });
  });
});

describe("an error that isn't an ApiError", () => {
  test.each([
    { why: "an Error", error: new Error("boom") },
    { why: "a TypeError", error: new TypeError("x is undefined") },
    { why: "a string", error: "boom" },
    { why: "undefined", error: undefined },
  ])("($why) is all left over and unexpected", ({ error }) => {
    expect(place(error)).toEqual({
      fields: {},
      leftover: true,
      mismatch: false,
      unplaced: [],
      unexpected: true,
    });
  });
});

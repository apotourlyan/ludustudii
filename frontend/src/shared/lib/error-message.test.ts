import { describe, expect, test, vi } from "vitest";

import { ApiError, type ApiFailure } from "@/api/http";

import { errorMessage, type FailureWording } from "./error-message";

const NETWORK = "Can't reach the server. Check your connection and try again.";
const GENERIC = "Something went wrong while trying to save your edits.";
const ACTION = "save your edits";

const httpError = (status: number, code?: Extract<ApiFailure, { kind: "http" }>["code"]) =>
  new ApiError({ kind: "http", status, code, fieldErrors: [], requestId: "req-1" });

describe("a network failure", () => {
  test("asks to check the connection, whatever the module's wording", () => {
    const wording = vi.fn<FailureWording>(() => "The module's text");

    expect(errorMessage(new ApiError({ kind: "network" }), ACTION, wording)).toBe(NETWORK);
    expect(wording).not.toHaveBeenCalled();
  });
});

describe("an HTTP failure", () => {
  test("gets the module's wording for it", () => {
    const error = httpError(404, "not_found");
    const wording = vi.fn<FailureWording>(() => "This card doesn't exist.");

    expect(errorMessage(error, ACTION, wording)).toBe("This card doesn't exist.");
    expect(wording).toHaveBeenCalledExactlyOnceWith(error.failure);
  });

  test.each([
    { status: 400, code: "validation_error" },
    { status: 404, code: "not_found" },
    { status: 500, code: "unexpected_error" },
    // A body that isn't the API's error shape, such as a proxy's page.
    { status: 502, code: undefined },
  ] as const)(
    "$status $code names the action when the module has no wording for it",
    ({ status, code }) => {
      expect(errorMessage(httpError(status, code), ACTION, () => undefined)).toBe(GENERIC);
      expect(errorMessage(httpError(status, code), ACTION)).toBe(GENERIC);
    },
  );
});

describe("an error that isn't an ApiError", () => {
  test.each([new Error("boom"), new TypeError("x is undefined"), "boom", undefined, null])(
    "%j names the action without asking the module",
    (error) => {
      const wording = vi.fn<FailureWording>(() => "The module's text");

      expect(errorMessage(error, ACTION, wording)).toBe(GENERIC);
      expect(wording).not.toHaveBeenCalled();
    },
  );
});

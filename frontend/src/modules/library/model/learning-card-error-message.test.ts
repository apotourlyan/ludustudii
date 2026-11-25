import { expect, test } from "vitest";

import { ApiError } from "@/api/http";

import { learningCardErrorMessage } from "./learning-card-error-message";

const httpError = (status: number) =>
  new ApiError({ kind: "http", status, code: undefined, fieldErrors: [], requestId: undefined });

test("a missing card says the card doesn't exist", () => {
  expect(learningCardErrorMessage(httpError(404), "delete this card")).toBe(
    "This card doesn't exist. It may have been deleted.",
  );
});

test("a network failure gets the shared wording", () => {
  expect(learningCardErrorMessage(new ApiError({ kind: "network" }), "delete this card")).toBe(
    "Can't reach the server. Check your connection and try again.",
  );
});

test.each([400, 409, 500, 503])("any other HTTP status (%i) names the action", (status) => {
  expect(learningCardErrorMessage(httpError(status), "delete this card")).toBe(
    "Something went wrong while trying to delete this card.",
  );
});

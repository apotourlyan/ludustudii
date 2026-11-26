import {
  defaultValidationLogic,
  FieldApi,
  FormApi,
  type ValidationLogicFn,
} from "@tanstack/react-form";
import { describe, expect, test } from "vitest";

import { keepServerErrorsOnBlur } from "./keep-server-errors-on-blur";

// A form with a title field that the server rejected.
function rejectedTitle(validationLogic: ValidationLogicFn) {
  const form = new FormApi({ defaultValues: { title: "a" }, validationLogic });
  form.mount();
  const field = new FieldApi({ form, name: "title", validators: { onChange: () => undefined } });
  field.mount();
  form.setFieldMeta("title", (meta) => ({
    ...meta,
    errorMap: { ...meta.errorMap, onServer: ["max_length"] },
  }));
  return field;
}

describe("keepServerErrorsOnBlur", () => {
  test("keeps the server's error when the field loses focus", () => {
    const field = rejectedTitle(keepServerErrorsOnBlur);

    field.handleBlur();

    expect(field.state.meta.errorMap.onServer).toEqual(["max_length"]);
  });

  test("drops it when the field changes", () => {
    const field = rejectedTitle(keepServerErrorsOnBlur);

    field.handleChange("b");

    expect(field.state.meta.errorMap.onServer).toBeUndefined();
  });

  // What it changes: TanStack Form's own logic drops the error on a blur.
  test("differs from the default logic only on a blur", () => {
    const field = rejectedTitle(defaultValidationLogic);

    field.handleBlur();

    expect(field.state.meta.errorMap.onServer).toBeUndefined();
  });
});

import type { AnyFieldLikeMetaBase } from "@tanstack/react-form";
import type { RefObject } from "react";

import type { ApiFieldError } from "@/api/http";
import { useErrorToast } from "@/shared/use-error-toast";

type FieldCode = ApiFieldError["code"];

// What a form does with a failed submit (ADR 0038, 0041). The form keeps
// the user's input. A module's model/ decides it from the error, with
// placeFieldErrors (field-errors.ts) and its own wording.
export interface FormFailure<Field extends string> {
  // The API's codes for each field it reported, to show on that field. A
  // field without any is absent, which clears what it showed.
  fields: Readonly<Partial<Record<Field, readonly FieldCode[]>>>;
  // The toast for what no field shows (ADR 0041), or undefined when the
  // fields show it all.
  notice: string | undefined;
  // What to log to the console for developers, as console.error's
  // arguments; empty for nothing: an error that isn't an API failure is a
  // bug, and field errors the form can't place mean the API and the form
  // disagree about the contract.
  log: readonly unknown[];
}

// What useFormFailure needs of a TanStack form: to set a field's server
// error and to read whether a field shows any error.
export interface FailureForm<Field extends string> {
  setFieldMeta(name: Field, updater: (meta: AnyFieldLikeMetaBase) => AnyFieldLikeMetaBase): void;
  getFieldMeta(name: Field): { errors: readonly unknown[] } | undefined;
}

// How a form reports a failed submit. `fields` are the form's fields in
// its order, which decides the focus, and `formRef` holds its element,
// whose controls are named after the fields.
//
// report applies a failure: each field's codes become its server error,
// which TanStack Form clears when the field changes (ADR 0038, with
// keepServerErrorsOnBlur as the form's validationLogic), so a field the
// failure doesn't name loses the last one's; the notice is the form's
// error toast, replacing the last one (ADR 0041); the log goes to
// console.error; and the focus moves to the first invalid field. clear
// closes the toast, as when the user submits again. focusFirstInvalid
// moves the focus to the first field, in `fields`' order, that shows an
// error, whoever found it, as after the form's own checks stop a submit
// (ADR 0038).
export function useFormFailure<Field extends string>(
  form: FailureForm<Field>,
  fields: readonly Field[],
  formRef: RefObject<HTMLFormElement | null>,
) {
  const toast = useErrorToast();

  function focusFirstInvalid() {
    const name = fields.find((field) => form.getFieldMeta(field)?.errors.length);
    const element = name && formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  }

  function report(failure: FormFailure<Field>) {
    for (const name of fields) {
      form.setFieldMeta(name, (meta) => ({
        ...meta,
        errorMap: { ...meta.errorMap, onServer: failure.fields[name] },
      }));
    }
    if (failure.notice !== undefined) {
      toast.show(failure.notice);
    }
    if (failure.log.length > 0) {
      console.error(...failure.log);
    }
    focusFirstInvalid();
  }

  return { report, clear: toast.clear, focusFirstInvalid };
}

import { useField, useForm } from "@tanstack/react-form";
import { createRef, type RefObject } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render, renderHook } from "vitest-browser-react";
import { page } from "vitest/browser";

import { keepServerErrorsOnBlur } from "@/shared/keep-server-errors-on-blur";
import { Toaster } from "@/shared/ui/toast";

import { useFormFailure, type FormFailure } from "./use-form-failure";

type Field = "first" | "second";

// The fields in the form's order, which its markup reverses, so the focus
// shows which order the hook follows.
const FIELDS: readonly Field[] = ["first", "second"];

// The error toasts on screen. Until the user moves into the toaster, it
// hides an error toast from assistive technology (tests/support/toasts.ts).
const toasts = page
  .getByRole("region", { name: "Notifications" })
  .getByRole("alertdialog", { includeHidden: true });

const NO_FAILURE: FormFailure<Field> = { fields: {}, notice: undefined, log: [] };

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A two-field form with its fields mounted, reporting through the hook,
// and its markup, which lists the fields in the opposite order, with the
// app's toaster.
async function renderTwoFieldForm() {
  const formRef: RefObject<HTMLFormElement | null> = createRef();
  await render(
    <>
      <form ref={formRef} aria-label="Two fields">
        <input name="second" aria-label="Second" />
        <input name="first" aria-label="First" />
      </form>
      <Toaster />
    </>,
  );
  return renderHook(() => {
    const form = useForm({
      defaultValues: { first: "", second: "" },
      validationLogic: keepServerErrorsOnBlur,
    });
    useField({ form, name: "first" });
    useField({ form, name: "second" });
    return { form, failure: useFormFailure(form, FIELDS, formRef) };
  });
}

test("report puts each field's codes on it and clears the others'", async () => {
  const { act, result } = await renderTwoFieldForm();
  await act(() =>
    result.current.failure.report({
      ...NO_FAILURE,
      fields: { first: ["required"], second: ["max_length"] },
    }),
  );

  await act(() =>
    result.current.failure.report({ ...NO_FAILURE, fields: { second: ["required"] } }),
  );

  const { form } = result.current;
  expect(form.getFieldMeta("first")?.errors).toEqual([]);
  expect(form.getFieldMeta("second")?.errorMap.onServer).toEqual(["required"]);
  expect(form.getFieldMeta("second")?.errors).not.toEqual([]);
});

test("a notice shows one toast, which clear closes", async () => {
  const { act, result } = await renderTwoFieldForm();
  await act(() => result.current.failure.report({ ...NO_FAILURE, notice: "First failure." }));
  await expect.element(toasts).toHaveTextContent("First failure.");

  await act(() => result.current.failure.report({ ...NO_FAILURE, notice: "Second failure." }));

  await expect.poll(() => toasts.elements()).toHaveLength(1);
  await expect.element(toasts).toHaveTextContent("Second failure.");
  await act(() => result.current.failure.clear());
  await expect.poll(() => toasts.elements()).toHaveLength(0);
});

test("the log goes to console.error once", async () => {
  const { act, result } = await renderTwoFieldForm();
  const error = new Error("A bug.");

  await act(() => result.current.failure.report({ ...NO_FAILURE, log: [error] }));

  expect(consoleError).toHaveBeenCalledExactlyOnceWith(error);
});

test("an empty log logs nothing", async () => {
  const { act, result } = await renderTwoFieldForm();

  await act(() => result.current.failure.report(NO_FAILURE));

  expect(consoleError).not.toHaveBeenCalled();
});

test("the focus moves to the first invalid field in the given order, not the DOM's", async () => {
  const { act, result } = await renderTwoFieldForm();

  await act(() =>
    result.current.failure.report({
      ...NO_FAILURE,
      fields: { first: ["required"], second: ["required"] },
    }),
  );

  await expect.element(page.getByRole("textbox", { name: "First" })).toHaveFocus();
});

test("focusFirstInvalid skips a valid field", async () => {
  const { act, result } = await renderTwoFieldForm();
  await act(() =>
    result.current.failure.report({ ...NO_FAILURE, fields: { second: ["required"] } }),
  );
  await act(() => page.getByRole("textbox", { name: "First" }).element().focus());

  await act(() => result.current.failure.focusFirstInvalid());

  await expect.element(page.getByRole("textbox", { name: "Second" })).toHaveFocus();
});

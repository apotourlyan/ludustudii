import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { renderWithProviders } from "@/test/render";

import { useLearningCardFormInstance } from "./learning-card-form-hook";
import type { LearningCardFormState } from "./learning-card-form.state";
import { LearningCardFormView } from "./learning-card-form.view";

type FieldState = LearningCardFormState["title"];

function field(name: "title" | "description", overrides: Partial<FieldState> = {}): FieldState {
  return {
    name,
    value: "",
    label: name === "title" ? "Title" : "Description",
    meta: name === "title" ? "0/200" : "0/2000",
    progress: 0,
    errors: [],
    invalid: false,
    active: false,
    // The view only passes them on; these find nothing.
    validators: { onChange: () => undefined, onSubmit: () => undefined },
    maxLength: 400,
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    ...overrides,
  };
}

// The view with the given props. Its fields bind to a form, so it gets a
// real one, empty and without validators; everything else is given.
function View(props: Partial<Omit<LearningCardFormState, "form" | "formRef">>) {
  const form = useLearningCardFormInstance({ defaultValues: { title: "", description: "" } });
  return (
    <LearningCardFormView
      form={form}
      formRef={{ current: null }}
      onSubmit={vi.fn()}
      title={field("title")}
      description={field("description")}
      preview={{ title: "", description: "" }}
      cancelLink={{ to: "/library/cards" }}
      submitLabel="Create card"
      submitDisabled={false}
      {...props}
    />
  );
}

const render = (props: Parameters<typeof View>[0] = {}) =>
  renderWithProviders(<View {...props} />, { url: "/library/cards/new" });

test("labels each field, with its counter", async () => {
  await render({ title: field("title", { meta: "14/200" }) });

  await expect.element(page.getByLabelText("Title")).toHaveAttribute("name", "title");
  await expect.element(page.getByLabelText("Description")).toHaveAttribute("name", "description");
  await expect.element(page.getByText("14/200")).toBeVisible();
  await expect.element(page.getByText("0/2000")).toBeVisible();
  await expect.element(page.getByLabelText("Title")).toHaveAttribute("maxlength", "400");
});

test("shows the submit label, enabled, and Cancel going where it was told", async () => {
  await render();

  await expect.element(page.getByRole("button", { name: "Create card" })).toBeEnabled();
  await expect
    .element(page.getByRole("link", { name: "Cancel" }))
    .toHaveAttribute("href", "/library/cards");
});

test("shows the saving label on a disabled button", async () => {
  await render({ submitLabel: "Updating...", submitDisabled: true });

  await expect.element(page.getByRole("button", { name: "Updating..." })).toBeDisabled();
});

test("shows a field's errors in its status bar, with the invalid look", async () => {
  await render({
    description: field("description", {
      errors: [{ message: "Description is required" }],
      invalid: true,
    }),
  });

  const error = page.getByRole("alert");
  await expect.element(error).toHaveTextContent("Description is required");
  await expect.element(page.getByLabelText("Description")).toHaveAttribute("aria-invalid", "true");
  // The status bar and the label bar take the destructive tint.
  expect(error.element().closest(".text-destructive.bg-destructive\\/10")).not.toBeNull();
  expect(page.getByText("0/2000").element().closest(".bg-destructive\\/10")).not.toBeNull();
});

test("a valid field has no error and no invalid look", async () => {
  await render();

  expect(page.getByRole("alert").elements()).toHaveLength(0);
  await expect.element(page.getByLabelText("Title")).toHaveAttribute("aria-invalid", "false");
  expect(
    page.getByText("0/200", { exact: true }).element().closest(".bg-destructive\\/10"),
  ).toBeNull();
});

test("lists several errors of one field", async () => {
  await render({
    title: field("title", {
      errors: [{ message: "Title is required" }, { message: "Title is too odd" }],
      invalid: true,
    }),
  });

  await expect.element(page.getByRole("listitem").nth(0)).toHaveTextContent("Title is required");
  await expect.element(page.getByRole("listitem").nth(1)).toHaveTextContent("Title is too odd");
});

test("tells the state which field has the focus", async () => {
  const title = field("title");
  await render({ title });

  await page.getByLabelText("Title").click();
  expect(title.onFocus).toHaveBeenCalledOnce();
  await page.getByLabelText("Description").click();
  expect(title.onBlur).toHaveBeenCalledOnce();
});

test("shows the preview it is given", async () => {
  await render({ preview: { title: "Photosynthesis", description: "How plants make sugar." } });

  const preview = page.getByRole("region", { name: "Preview" });
  await expect.element(preview.getByText("Photosynthesis")).toBeVisible();
  await expect.element(preview.getByText("How plants make sugar.")).toBeVisible();
});

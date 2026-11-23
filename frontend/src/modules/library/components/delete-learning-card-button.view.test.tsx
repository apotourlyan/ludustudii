import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import type { DeleteLearningCardButtonState } from "./delete-learning-card-button.state";
import { DeleteLearningCardButtonView } from "./delete-learning-card-button.view";

function props(overrides: Partial<DeleteLearningCardButtonState> = {}) {
  return {
    open: false,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    deleting: false,
    confirmLabel: "Delete",
    ...overrides,
  } satisfies DeleteLearningCardButtonState;
}

test("closed, it is the Delete button, which asks to open the dialog", async () => {
  const given = props();
  await render(<DeleteLearningCardButtonView {...given} />);

  expect(page.getByRole("alertdialog").elements()).toHaveLength(0);
  await page.getByRole("button", { name: "Delete" }).click();

  expect(given.onOpenChange).toHaveBeenCalledWith(true, expect.anything());
});

test("open, it asks to confirm, and the confirm button deletes", async () => {
  const given = props({ open: true });
  await render(<DeleteLearningCardButtonView {...given} />);

  const dialog = page.getByRole("alertdialog");
  await expect.element(dialog).toHaveAccessibleName("Delete this learning card?");
  await expect
    .element(dialog)
    .toHaveAccessibleDescription(
      "This action cannot be undone. The card will be permanently removed.",
    );
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Delete" }).click();

  expect(given.onConfirm).toHaveBeenCalledOnce();
});

test("while deleting, both buttons are disabled and the label says so", async () => {
  await render(
    <DeleteLearningCardButtonView
      {...props({ open: true, deleting: true, confirmLabel: "Deleting..." })}
    />,
  );

  const dialog = page.getByRole("alertdialog");
  await expect.element(dialog.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
});

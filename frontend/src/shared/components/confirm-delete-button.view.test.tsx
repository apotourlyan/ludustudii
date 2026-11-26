import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import type { ConfirmDeleteButtonState } from "./confirm-delete-button.state";
import { ConfirmDeleteButtonView } from "./confirm-delete-button.view";

function props(overrides: Partial<ConfirmDeleteButtonState> = {}) {
  return {
    title: "Delete this thing?",
    description: "It will be gone.",
    open: false,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    deleting: false,
    confirmLabel: "Delete",
    ...overrides,
  } satisfies ConfirmDeleteButtonState;
}

test("closed, it is the Delete button, which asks to open the dialog", async () => {
  const given = props();
  await render(<ConfirmDeleteButtonView {...given} />);

  expect(page.getByRole("alertdialog").elements()).toHaveLength(0);
  await page.getByRole("button", { name: "Delete" }).click();

  expect(given.onOpenChange).toHaveBeenCalledWith(true, expect.anything());
});

test("open, it asks to confirm with its title and description, and the confirm button deletes", async () => {
  const given = props({ open: true });
  await render(<ConfirmDeleteButtonView {...given} />);

  const dialog = page.getByRole("alertdialog");
  await expect.element(dialog).toHaveAccessibleName("Delete this thing?");
  await expect.element(dialog).toHaveAccessibleDescription("It will be gone.");
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Delete" }).click();

  expect(given.onConfirm).toHaveBeenCalledOnce();
});

test("while deleting, both buttons are disabled and the label says so", async () => {
  await render(
    <ConfirmDeleteButtonView
      {...props({ open: true, deleting: true, confirmLabel: "Deleting..." })}
    />,
  );

  const dialog = page.getByRole("alertdialog");
  await expect.element(dialog.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
});

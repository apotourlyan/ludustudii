import { afterEach, expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { notifyError } from "@/shared/lib/notify";

import { useConfirmDeleteButton } from "./confirm-delete-button.state";

// Toasts aren't the network: the test checks what the button reports, and
// counts the toasts it closes.
const toasts = vi.hoisted(() => ({ dismissed: 0 }));
vi.mock("@/shared/lib/notify", () => ({
  notifyError: vi.fn(() => () => {
    toasts.dismissed += 1;
  }),
}));

afterEach(() => {
  vi.mocked(notifyError).mockClear();
  toasts.dismissed = 0;
});

// A failure's message names the error it was given, so a test sees which
// error reached it.
function failureMessage(error: unknown) {
  return `Couldn't delete: ${String(error)}`;
}

async function renderDelete(onConfirm: () => Promise<unknown> = () => Promise.resolve()) {
  const confirmed = vi.fn(onConfirm);
  const onDeleted = vi.fn();
  const rendered = await renderHook(() =>
    useConfirmDeleteButton({
      title: "Delete this thing?",
      description: "It will be gone.",
      onConfirm: confirmed,
      failureMessage,
      onDeleted,
    }),
  );
  // Opens the dialog, as pressing the button does.
  await rendered.act(() => rendered.result.current.onOpenChange(true));
  return { ...rendered, confirmed, onDeleted };
}

async function confirm({ act, result }: Awaited<ReturnType<typeof renderDelete>>) {
  await act(() => result.current.onConfirm());
  await expect.poll(() => result.current.deleting).toBe(false);
}

test("a delete that succeeds closes the dialog and calls onDeleted", async () => {
  const button = await renderDelete();
  expect(button.result.current.open).toBe(true);

  await confirm(button);

  expect(button.confirmed).toHaveBeenCalledOnce();
  expect(button.onDeleted).toHaveBeenCalledOnce();
  expect(button.result.current.open).toBe(false);
  expect(notifyError).not.toHaveBeenCalled();
});

test("a delete that fails closes the dialog and toasts its message, without onDeleted", async () => {
  const button = await renderDelete(() => Promise.reject(new Error("gone")));

  await confirm(button);

  expect(notifyError).toHaveBeenCalledExactlyOnceWith("Couldn't delete: Error: gone");
  expect(button.onDeleted).not.toHaveBeenCalled();
  expect(button.result.current.open).toBe(false);
});

test("trying again closes the last failure's toast", async () => {
  const button = await renderDelete(() => Promise.reject(new Error("offline")));
  await confirm(button);
  expect(toasts.dismissed).toBe(0);

  await button.act(() => button.result.current.onOpenChange(true));
  await confirm(button);

  expect(toasts.dismissed).toBe(1);
  expect(notifyError).toHaveBeenCalledTimes(2);
});

test("while deleting, the dialog stays open and the button says so", async () => {
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  const button = await renderDelete(() => held);
  expect(button.result.current).toMatchObject({ deleting: false, confirmLabel: "Delete" });

  await button.act(() => button.result.current.onConfirm());
  await expect
    .poll(() => button.result.current)
    .toMatchObject({ deleting: true, confirmLabel: "Deleting..." });
  await button.act(() => button.result.current.onOpenChange(false));
  expect(button.result.current.open).toBe(true);

  release();
  await expect.poll(() => button.result.current.open).toBe(false);
  expect(button.result.current).toMatchObject({ deleting: false, confirmLabel: "Delete" });
  expect(button.onDeleted).toHaveBeenCalledOnce();
});

test("the dialog opens and closes while nothing runs", async () => {
  const button = await renderDelete();

  await button.act(() => button.result.current.onOpenChange(false));

  expect(button.result.current.open).toBe(false);
  expect(button.confirmed).not.toHaveBeenCalled();
  expect(button.onDeleted).not.toHaveBeenCalled();
});

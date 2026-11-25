import { expect, test } from "vitest";
import { renderHook } from "vitest-browser-react";
import { page } from "vitest/browser";

import { Toaster } from "@/shared/ui/toast";

import { useErrorToast } from "./use-error-toast";

// The error toasts on screen. Until the user moves into the toaster, it
// hides an error toast from assistive technology (tests/support/toasts.ts).
const toasts = page
  .getByRole("region", { name: "Notifications" })
  .getByRole("alertdialog", { includeHidden: true });

// The hook with the app's toaster, which shows what it reports.
function renderErrorToast() {
  return renderHook(() => useErrorToast(), {
    wrapper: ({ children }) => (
      <>
        {children}
        <Toaster />
      </>
    ),
  });
}

test("show closes the toast it showed before, leaving one with the new message", async () => {
  const { act, result } = await renderErrorToast();

  await act(() => result.current.show("First failure."));
  await expect.element(toasts).toHaveTextContent("First failure.");
  await act(() => result.current.show("Second failure."));

  await expect.poll(() => toasts.elements()).toHaveLength(1);
  await expect.element(toasts).toHaveTextContent("Second failure.");
  await act(() => result.current.clear());
});

test("clear closes the toast", async () => {
  const { act, result } = await renderErrorToast();
  await act(() => result.current.show("A failure."));
  await expect.element(toasts).toHaveTextContent("A failure.");

  await act(() => result.current.clear());

  await expect.poll(() => toasts.elements()).toHaveLength(0);
});

// Another call site's toast, such as a second card's, stays.
test("clear with no toast shown does nothing", async () => {
  const other = await renderErrorToast();
  await other.act(() => other.result.current.show("Another failure."));
  await expect.element(toasts).toHaveTextContent("Another failure.");
  const { act, result } = await renderHook(() => useErrorToast());

  await act(() => result.current.clear());

  expect(toasts.elements()).toHaveLength(1);
  await other.act(() => other.result.current.clear());
});

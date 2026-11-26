import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { Toaster } from "@/shared/ui/toast";

import { notifyError, type CloseToast } from "./notify";

// The error toasts on screen, newest first. Until the user moves into the
// toaster, it hides an error toast from assistive technology
// (tests/support/toasts.ts).
const toasts = page
  .getByRole("region", { name: "Notifications" })
  .getByRole("alertdialog", { includeHidden: true });

// The alerts that announce a message: assistive technology reads an alert
// at once, interrupting what it was reading.
function announcements(message: string) {
  return page.getByRole("alert").filter({ hasText: message });
}

const SAVE_FAILED = "Something went wrong while trying to save your edits.";
const CREATE_FAILED = "Something went wrong while trying to create the card.";
const DELETE_FAILED = "Something went wrong while trying to delete the card.";
const OFFLINE = "Can't reach the server. Check your connection and try again.";

// What each test opened, closed after it, so the next starts with none.
let opened: CloseToast[] = [];

function notify(message: string): void {
  opened.push(notifyError(message));
}

afterEach(() => {
  vi.useRealTimers();
  for (const close of opened) {
    close();
  }
  opened = [];
});

function renderToaster() {
  return render(<Toaster />);
}

test("an error toast is announced at once", async () => {
  await renderToaster();

  notify(DELETE_FAILED);

  await expect.element(toasts).toHaveTextContent(DELETE_FAILED);
  await expect.poll(() => announcements(DELETE_FAILED).elements()).toHaveLength(1);
});

// An alert is read when it appears, not while it stays, so a failure
// again needs an alert of its own, still for one toast.
test("the same failure again is announced by a new alert, with one toast", async () => {
  await renderToaster();
  notify(SAVE_FAILED);
  await expect.poll(() => announcements(SAVE_FAILED).elements()).toHaveLength(1);
  const first = announcements(SAVE_FAILED).element();

  notify(SAVE_FAILED);

  await expect.poll(() => first.isConnected).toBe(false);
  await expect.poll(() => announcements(SAVE_FAILED).elements()).toHaveLength(1);
  await expect.poll(() => toasts.elements()).toHaveLength(1);
});

// The toaster shows the newest 3 toasts and hides the rest. A failure whose
// toast is among the hidden ones shows it again, in front.
test("a failure again brings its toast to the front, even from behind the others", async () => {
  await renderToaster();
  for (const message of [DELETE_FAILED, CREATE_FAILED, SAVE_FAILED, OFFLINE]) {
    notify(message);
    await expect.element(toasts.first()).toHaveTextContent(message);
  }
  await expect.poll(() => toasts.elements()).toHaveLength(4);

  notify(DELETE_FAILED);

  await expect.element(toasts.first()).toHaveTextContent(DELETE_FAILED);
  await expect.poll(() => toasts.elements()).toHaveLength(4);
});

test("an error toast stays a minute later, and goes when dismissed with the mouse", async () => {
  await renderToaster();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  notify(DELETE_FAILED);
  await expect.element(toasts).toHaveTextContent(DELETE_FAILED);

  vi.advanceTimersByTime(60_000);
  vi.useRealTimers();

  await expect.element(toasts).toBeVisible();
  await toasts.getByRole("button", { name: "Dismiss", includeHidden: true }).click();
  await expect.poll(() => toasts.elements()).toHaveLength(0);
});

test("an error toast goes when dismissed with the keyboard", async () => {
  await renderToaster();
  notify(DELETE_FAILED);
  await expect.element(toasts).toHaveTextContent(DELETE_FAILED);

  // F6 moves the focus into the toasts, Tab to the newest, and Escape
  // dismisses it.
  await userEvent.keyboard("{F6}");
  await userEvent.keyboard("{Tab}");
  await expect.element(toasts).toHaveFocus();
  await userEvent.keyboard("{Escape}");

  await expect.poll(() => toasts.elements()).toHaveLength(0);
});

// The app's toasts (ADR 0041), found the way assistive technology finds
// them.

import type { Locator, Page } from "@playwright/test";

// The toasts on screen, newest first. Base UI's toaster is a region named
// "Notifications", and each toast in it a dialog named by its message, an
// alertdialog for an error. Until the user moves into the region (F6), it
// hides an error toast from assistive technology and announces a copy of
// its message in an alert instead, so the toasts themselves are found with
// includeHidden.
export function toasts(page: Page): Locator {
  return page
    .getByRole("region", { name: "Notifications" })
    .getByRole("alertdialog", { includeHidden: true });
}

// The toast showing the message.
export function toast(page: Page, message: string | RegExp): Locator {
  return toasts(page).filter({ hasText: message });
}

// Makes the API answer a save with a 400 validation_error of the test's
// choosing. The mock mode's fake backend only rejects what the form already
// prevents, and answers requests in a service worker, before Playwright's
// routing sees them, so this wraps the page's fetch in an init script, as
// watchListRequests does (support/overview.ts). Call it before page.goto.

import type { Page } from "@playwright/test";

export interface FieldError {
  field: string;
  code: string;
}

// The request ID of every rejection, to find it in the console.
export const REJECTION_REQUEST_ID = "7f3c2a10-0000-4000-8000-000000000038";

declare global {
  interface Window {
    // Set by rejectSaves, changed by setRejection.
    saveRejection?: FieldError[] | null;
  }
}

export async function rejectSaves(page: Page): Promise<void> {
  await page.addInitScript((requestId) => {
    window.saveRejection = null;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      if (
        window.saveRejection &&
        (method === "POST" || method === "PUT") &&
        url.pathname.startsWith("/api/lcards")
      ) {
        return Promise.resolve(
          new Response(JSON.stringify({ code: "validation_error", errors: window.saveRejection }), {
            status: 400,
            headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
          }),
        );
      }
      return original(input, init);
    };
  }, REJECTION_REQUEST_ID);
}

// The field errors the next saves answer with, or null to let them through
// to the fake backend.
export async function setRejection(page: Page, errors: FieldError[] | null): Promise<void> {
  await page.evaluate((value) => {
    window.saveRejection = value;
  }, errors);
}

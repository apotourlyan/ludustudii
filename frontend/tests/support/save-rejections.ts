// Makes the API answer a save with a 400 validation_error of the test's
// choosing, from inside the page (see support/fetch.ts). The mock mode's
// fake backend only rejects what the form already prevents. Call
// rejectSaves before page.goto.

import type { Page } from "@playwright/test";

import { interceptFetch } from "./fetch";

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
  await interceptFetch(page);
  await page.addInitScript((requestId) => {
    window.saveRejection = null;
    window.fetchInterceptors!.push(({ url, method }) => {
      const errors = window.saveRejection;
      if (!errors || (method !== "POST" && method !== "PUT")) {
        return undefined;
      }
      if (!url.pathname.startsWith("/api/lcards")) {
        return undefined;
      }
      return Promise.resolve(
        new Response(JSON.stringify({ code: "validation_error", errors }), {
          status: 400,
          headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
        }),
      );
    });
  }, REJECTION_REQUEST_ID);
}

// The field errors the next saves answer with, or null to let them through
// to the fake backend.
export async function setRejection(page: Page, errors: FieldError[] | null): Promise<void> {
  await page.evaluate((value) => {
    window.saveRejection = value;
  }, errors);
}

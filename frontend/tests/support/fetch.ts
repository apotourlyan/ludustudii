// Lets tests answer or watch the page's requests from inside the page. The
// mock mode's fake backend answers requests in a service worker, before
// Playwright's routing sees them, so this wraps the page's fetch in an init
// script, before the app's API client takes it.

import type { Page } from "@playwright/test";

// A request as interceptors see it.
export interface InterceptedRequest {
  url: URL;
  // Upper case.
  method: string;
}

// Returns the request's outcome, or undefined to pass it on.
export type FetchInterceptor = (request: InterceptedRequest) => Promise<Response> | undefined;

declare global {
  interface Window {
    // Set by interceptFetch. Interceptors run in order; the first that
    // returns an outcome decides it.
    fetchInterceptors?: FetchInterceptor[];
  }
}

// Wraps the page's fetch once, however often it's called. Call it before
// page.goto, then add interceptors to window.fetchInterceptors in init
// scripts or page.evaluate.
export async function interceptFetch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.fetchInterceptors) return;
    const interceptors: FetchInterceptor[] = [];
    window.fetchInterceptors = interceptors;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const request = {
        url: new URL(input instanceof Request ? input.url : String(input), location.href),
        method: (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase(),
      };
      for (const interceptor of interceptors) {
        const outcome = interceptor(request);
        if (outcome) return outcome;
      }
      return original(input, init);
    };
  });
}

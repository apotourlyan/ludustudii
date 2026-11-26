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
  // Sends the request on, past the interceptors, for an interceptor that
  // answers it later with what the fake backend answers.
  pass: () => Promise<Response>;
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
    if (window.fetchInterceptors) {
      return;
    }
    const interceptors: FetchInterceptor[] = [];
    window.fetchInterceptors = interceptors;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const request = {
        url: new URL(input instanceof Request ? input.url : String(input), location.href),
        method: (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase(),
        pass: () => original(input, init),
      };
      for (const interceptor of interceptors) {
        const outcome = interceptor(request);
        if (outcome) {
          return outcome;
        }
      }
      return original(input, init);
    };
  });
}

declare global {
  interface Window {
    // Set by holdRequests.
    requestHold?: { held: number; released: boolean; release: () => void };
  }
}

// Runs in the page: holds the requests of this method whose path matches
// the pattern's source until window.requestHold.release().
function installHold({ method, source }: { method: string; source: string }): void {
  const pattern = new RegExp(source);
  const { promise: released, resolve: release } = Promise.withResolvers<void>();
  const hold = { held: 0, released: false, release };
  window.requestHold = hold;
  void released.then(() => {
    hold.released = true;
  });
  window.fetchInterceptors!.push((request) => {
    if (hold.released || request.method !== method || !pattern.test(request.url.pathname)) {
      return undefined;
    }
    hold.held += 1;
    return released.then(request.pass);
  });
}

// Holds the page's requests of this method whose path matches `path`,
// from the start or, on a page loaded after interceptFetch, from now,
// until releaseRequests: the page shows what it shows while they're
// pending, for as long as the test needs, instead of for a fixed delay.
// Then the fake backend answers them; later requests pass at once.
export async function holdRequests(page: Page, method: string, path: RegExp): Promise<void> {
  await interceptFetch(page);
  const args = { method, source: path.source };
  await page.addInitScript(installHold, args);
  // A page that has loaded ran the init scripts before this one.
  if (await page.evaluate(() => window.fetchInterceptors !== undefined)) {
    await page.evaluate(installHold, args);
  }
}

// How many requests holdRequests holds.
export async function heldRequests(page: Page): Promise<number> {
  return page.evaluate(() => window.requestHold?.held ?? 0);
}

// Lets the held requests through, and every later one.
export async function releaseRequests(page: Page): Promise<void> {
  await page.evaluate(() => window.requestHold!.release());
}

// Makes the API answer requests of the given methods with
// 500 unexpected_error, from inside the page (see support/fetch.ts), so a
// test can fail a save or a delete while the page's reads still succeed:
// every such request, or only the first `times`, so a retry succeeds.
// While the browser is offline, requests pass on and fail as network
// errors. Call failRequests before page.goto.

import type { Page } from "@playwright/test";

import { interceptFetch } from "./fetch";

declare global {
  interface Window {
    // Set by failRequests: how many requests it has failed.
    failedRequests?: number;
  }
}

export async function failRequests(
  page: Page,
  methods: string[],
  { times = Infinity }: { times?: number } = {},
): Promise<void> {
  await interceptFetch(page);
  await page.addInitScript(
    ({ failing, limit }) => {
      window.failedRequests = 0;
      window.fetchInterceptors!.push(({ url, method }) => {
        if (
          !navigator.onLine ||
          !failing.includes(method) ||
          !url.pathname.startsWith("/api/") ||
          window.failedRequests! >= limit
        ) {
          return undefined;
        }
        window.failedRequests! += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ code: "unexpected_error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });
    },
    // Infinity doesn't survive the trip into the page.
    { failing: methods, limit: Number.isFinite(times) ? times : Number.MAX_SAFE_INTEGER },
  );
}

// How many requests failRequests has failed so far.
export async function failedRequests(page: Page): Promise<number> {
  return page.evaluate(() => window.failedRequests ?? 0);
}

import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/http";

// How long fetched data counts as fresh before a read refetches it.
const QUERY_STALE_TIME_MS = 30_000;
// Retries after the first failure, for failures that a retry can fix.
const QUERY_MAX_RETRIES = 2;

// Only network failures and server errors (5xx) are retried (ADR 0031).
// Client errors, aborts and anything that isn't an ApiError fail at once.
const isRetryable = (error: unknown) =>
  error instanceof ApiError && (error.failure.kind === "network" || error.failure.status >= 500);

// A query client with the app's defaults. By default TanStack Query pauses
// requests while the browser reports being offline, which leaves a loading
// page up until the connection returns. 'always' sends them anyway, so
// going offline fails like any other network failure: retried as above,
// then reported. Tests make one per test (ADR 0043).
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "always",
        staleTime: QUERY_STALE_TIME_MS,
        retry: (failureCount, error) => isRetryable(error) && failureCount < QUERY_MAX_RETRIES,
      },
      mutations: {
        networkMode: "always",
      },
    },
  });
}

// The app's one query client (ADR 0030), passed to the router's context.
export const queryClient = createQueryClient();

// Renders a component or a hook as the app would (ADR 0043): with a query
// client of its own and, for a component that links or reads the router, in
// a router. Their requests reach the fake backend that setup.browser.ts
// starts.

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Suspense, type ReactNode } from "react";
import { render, renderHook, type RenderHookResult, type RenderResult } from "vitest-browser-react";

import { createQueryClient } from "@/app/query-client";

export interface RenderWithProvidersOptions {
  // Renders the UI as the only page of a router whose URL is this, for a
  // component that renders links or reads the router. Without it, there is
  // no router.
  url?: string;
}

// A new query client with the app's defaults, retrying at once instead of
// after a growing delay, so a test of a failure doesn't wait for retries.
function createTestQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retryDelay: 0 } });
  return queryClient;
}

// The UI in a router at `url`, which is loaded before it renders.
async function inRouter(ui: ReactNode, url: string): Promise<ReactNode> {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await router.load();
  return <RouterProvider router={router} />;
}

// Renders `ui` with a new query client, and in a router when `url` is
// given. A component that suspends, reading a query, renders once its data
// arrives. Returns what vitest-browser-react's render does, and the query
// client.
export async function renderWithProviders(
  ui: ReactNode,
  { url }: RenderWithProvidersOptions = {},
): Promise<RenderResult & { queryClient: QueryClient }> {
  const queryClient = createTestQueryClient();
  const content = <Suspense>{ui}</Suspense>;
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      {url === undefined ? content : await inRouter(content, url)}
    </QueryClientProvider>,
  );
  return Object.assign(screen, { queryClient });
}

// Renders the hook with a new query client, for a hook that reads queries
// or calls mutations. A hook that suspends, reading a query, returns once
// its data arrives. Returns what vitest-browser-react's renderHook does,
// and the query client.
export async function renderHookWithProviders<Result>(
  hook: () => Result,
): Promise<RenderHookResult<Result, undefined> & { queryClient: QueryClient }> {
  const queryClient = createTestQueryClient();
  const rendered = await renderHook(hook, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <Suspense>{children}</Suspense>
      </QueryClientProvider>
    ),
  });
  return Object.assign(rendered, { queryClient });
}

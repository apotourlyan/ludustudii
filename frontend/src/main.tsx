import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { ApiError } from '@/api/http'
import { RouteError } from '@/components/route-error'
import { RoutePending } from '@/components/route-pending'
import { routeTree } from './routeTree.gen.js'
import './styles/global.css'

// How long fetched data counts as fresh before a read refetches it.
const QUERY_STALE_TIME_MS = 30_000
// Retries after the first failure, for failures that a retry can fix.
const QUERY_MAX_RETRIES = 2

// Only network failures and server errors (5xx) are retried (ADR 0031).
// Client errors, aborts and anything that isn't an ApiError fail at once.
const isRetryable = (error: unknown) =>
  error instanceof ApiError &&
  (error.failure.kind === 'network' || error.failure.status >= 500)

// By default TanStack Query pauses requests while the browser reports being
// offline, which leaves a loading page up until the connection returns.
// 'always' sends them anyway, so going offline fails like any other network
// failure: retried as above, then reported.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      staleTime: QUERY_STALE_TIME_MS,
      retry: (failureCount, error) =>
        isRetryable(error) && failureCount < QUERY_MAX_RETRIES,
    },
    mutations: {
      networkMode: 'always',
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Run loaders on every navigation and preload; caching is the query
  // cache's job, not the router's.
  defaultPreloadStaleTime: 0,
  // Wait for those loaders instead of rendering the previous data and
  // reloading in the background, so stale data is fetched before rendering.
  defaultStaleReloadMode: 'blocking',
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)

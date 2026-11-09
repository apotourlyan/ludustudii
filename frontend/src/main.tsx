import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { HttpError } from '@/api/http-error'
import { RouteError } from '@/components/route-error'
import { RoutePending } from '@/components/route-pending'
import { routeTree } from './routeTree.gen.js'
import './styles/global.css'

// How long fetched data counts as fresh before a read refetches it.
const QUERY_STALE_TIME_MS = 30_000
// Retries after the first failure, for failures other than client errors.
const QUERY_MAX_RETRIES = 2

const isClientError = (error: unknown) =>
  error instanceof HttpError && error.status >= 400 && error.status < 500

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      retry: (failureCount, error) =>
        !isClientError(error) && failureCount < QUERY_MAX_RETRIES,
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

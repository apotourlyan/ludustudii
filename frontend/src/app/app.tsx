import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { Toaster } from "@/shared/ui/toast";

import { queryClient } from "./query-client";
import { router } from "./router";

// The client app: the query client and the router, which renders the root
// layout and the page for the current URL, and the toaster, which shows
// what notifyError reports (ADR 0041).
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}

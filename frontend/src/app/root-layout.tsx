import { Link, Outlet } from "@tanstack/react-router";
import * as React from "react";

import { NavigationProgress } from "./navigation-progress";

// Conditionally load devtools only in development
const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : React.lazy(() =>
      import("@tanstack/react-router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      })),
    );

// The layout around every page: the navigation progress bar (ADR 0041),
// the navigation, then the current route in the page's one <main>
// landmark, which pages leave to this layout (ADR 0036).
export function RootLayout() {
  return (
    <React.Fragment>
      <NavigationProgress />
      <nav className="flex gap-4 p-6">
        {/* Exact, so the list's link isn't also marked as the current page
            on the pages below it, such as /library/cards/new. Search params
            aside: the link names the default view, and the overview is
            the current page in either view. */}
        <Link to="/library/cards" activeOptions={{ exact: true, includeSearch: false }}>
          Learning Cards
        </Link>
        <Link to="/library/cards/new">Add Card</Link>
      </nav>
      <main>
        <Outlet />
      </main>
      <React.Suspense>
        {/* Bottom right: the toasts are at the bottom left. */}
        <TanStackRouterDevtools position="bottom-right" />
      </React.Suspense>
    </React.Fragment>
  );
}

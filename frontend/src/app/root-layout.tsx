import { Link, Outlet } from "@tanstack/react-router";
import * as React from "react";

// Conditionally load devtools only in development
const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : React.lazy(() =>
      import("@tanstack/react-router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      })),
    );

// The layout around every page: the navigation, then the current route in
// the page's one <main> landmark, which pages leave to this layout (ADR 0036).
export function RootLayout() {
  return (
    <React.Fragment>
      <nav className="flex gap-4 p-6">
        {/* Exact, so the list's link isn't also marked as the current page
            on the pages below it, such as /library/cards/new. */}
        <Link to="/library/cards" activeOptions={{ exact: true }}>
          Learning Cards
        </Link>
        <Link to="/library/cards/new">Add Card</Link>
      </nav>
      <main>
        <Outlet />
      </main>
      <React.Suspense>
        <TanStackRouterDevtools />
      </React.Suspense>
    </React.Fragment>
  );
}

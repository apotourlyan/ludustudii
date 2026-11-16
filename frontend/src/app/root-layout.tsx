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

// The layout around every page: the navigation, then the current route.
export function RootLayout() {
  return (
    <React.Fragment>
      <nav className="flex gap-4 p-6">
        <Link to="/learning-cards">Learning Cards</Link>
        <Link to="/learning-card">Add Card</Link>
      </nav>
      <Outlet />
      <React.Suspense>
        <TanStackRouterDevtools />
      </React.Suspense>
    </React.Fragment>
  );
}

import { Link } from "@tanstack/react-router";

import { Card, CardContent } from "@/shared/ui/card";

// The router's default not-found component, shown for a URL that names no
// page. A missing card has its own, LearningCardNotFoundPage.
export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Page not found</h1>
      <Card>
        <CardContent className="space-y-3">
          <p>There's no page at this address.</p>
          {/* Exact, so it isn't marked as the current page on an unknown
              URL below the list's, such as /library/cards/x/y. */}
          <Link
            to="/library/cards"
            activeOptions={{ exact: true }}
            className="text-sm text-primary underline underline-offset-4"
          >
            Go to the library
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

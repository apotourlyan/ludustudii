import { Link } from "@tanstack/react-router";

import { Card, CardContent } from "@/shared/ui/card";

// Shown for a card ID that doesn't exist, or that can't be one.
export function CardNotFoundPage() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Card not found</h1>
      <Card>
        <CardContent className="space-y-3">
          <p>This card doesn't exist. It may have been deleted.</p>
          {/* Exact, so it isn't marked as the current page on the card's URL below it. */}
          <Link
            to="/library/cards"
            activeOptions={{ exact: true }}
            className="text-sm text-primary underline underline-offset-4"
          >
            Back to learning cards
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

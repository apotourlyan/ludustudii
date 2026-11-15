import { Link } from "@tanstack/react-router";

import { Card, CardContent } from "@/shared/ui/card";

// Shown for a card ID that doesn't exist, or that can't be one.
export function CardNotFoundPage() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <Card>
        <CardContent className="space-y-3">
          <p>This card doesn't exist. It may have been deleted.</p>
          <Link to="/learning-cards" className="text-sm text-primary underline underline-offset-4">
            Back to learning cards
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

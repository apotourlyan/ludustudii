import { errorMessage, type FailureWording } from "@/shared/lib/error-message";

// What a failure means for a learning card. Failures that aren't about the
// card, such as the network, get the shared wording.
const cardFailureWording: FailureWording = (failure) => {
  if (failure.status === 404) {
    return "This card doesn't exist. It may have been deleted.";
  }
  return undefined;
};

// The user-facing text for a failed request about a card, phrased to follow
// "trying to" (see errorMessage).
export function learningCardErrorMessage(error: unknown, action: string): string {
  return errorMessage(error, action, cardFailureWording);
}

import { ApiError, type ApiFailure } from "@/api/http";

// A module's wording for an HTTP failure of its own resources, such as a
// missing card (ADR 0035), or undefined to leave it to errorMessage.
export type FailureWording = (
  failure: Extract<ApiFailure, { kind: "http" }>,
  action: string,
) => string | undefined;

// The only place generic user-facing error text is built. The API layer has no
// wording (ADR 0031), so the message is chosen from the failure and from the
// action the user tried, phrased to follow "trying to", for example
// "save your edits". A module passes its own wording for the rest.
export function errorMessage(error: unknown, action: string, wording?: FailureWording): string {
  if (error instanceof ApiError) {
    const { failure } = error;
    if (failure.kind === "network") {
      return "Can't reach the server. Check your connection and try again.";
    }
    const message = wording?.(failure, action);
    if (message !== undefined) {
      return message;
    }
  }
  return `Something went wrong while trying to ${action}.`;
}

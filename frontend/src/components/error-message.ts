import { ApiError } from '@/api/http'

// The only place user-facing error text is built. The API layer has no
// wording (ADR 0031), so the message is chosen from the failure and from the
// action the user tried, phrased to follow "trying to", for example
// "save your edits".
export function errorMessage(error: unknown, action: string): string {
  if (error instanceof ApiError) {
    const { failure } = error
    if (failure.kind === 'network') {
      return "Can't reach the server. Check your connection and try again."
    }
    if (failure.status === 412) {
      return `This card has changed. Reload it before you ${action}.`
    }
    if (failure.status === 404) {
      return "This card doesn't exist. It may have been deleted."
    }
  }
  return `Something went wrong while trying to ${action}.`
}

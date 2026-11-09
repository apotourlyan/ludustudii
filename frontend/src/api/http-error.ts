// A non-2xx response. The status lets callers, such as the query client's
// retry policy, tell client errors (4xx) from other failures.
export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

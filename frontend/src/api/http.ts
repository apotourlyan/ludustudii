import createClient, { type Client, type Middleware } from 'openapi-fetch'
import type { components } from './schema.gen'

type ErrorResponse = components['schemas']['ErrorResponse']
export type ApiErrorCode = ErrorResponse['code']
export type ApiFieldError = components['schemas']['FieldError']

// Why a request failed: the network, or an HTTP error response. An HTTP
// failure carries what the response says about it (ADR 0025).
export type ApiFailure =
  | { readonly kind: 'network' }
  | {
      readonly kind: 'http'
      readonly status: number
      // undefined when the body isn't the API's error shape, such as a
      // proxy's HTML error page.
      readonly code: ApiErrorCode | undefined
      readonly fieldErrors: readonly ApiFieldError[]
      readonly requestId: string | undefined
    }

export type ApiError = Error & ApiFailure

// A class can't declare its instances as a union, so the constructor is typed
// to return one: after `instanceof ApiError`, checking `kind` narrows to the
// HTTP fields. The message is for developers only; user-facing wording is
// chosen by the client app from the failure, never from the message.
export const ApiError = class ApiError extends Error {
  constructor(failure: ApiFailure, options?: ErrorOptions) {
    super(describe(failure), options)
    this.name = 'ApiError'
    Object.assign(this, failure)
  }
} as new (failure: ApiFailure, options?: ErrorOptions) => ApiError

function describe(failure: ApiFailure): string {
  if (failure.kind === 'network') {
    return 'network failure'
  }
  const { status, code, requestId } = failure
  return [`HTTP ${status}`, code, requestId && `(request ${requestId})`]
    .filter(Boolean)
    .join(' ')
}

// Creates the client for one backend service from its generated paths type
// and its base URL in apiBaseUrls.
export function createApiClient<Paths extends {}>(baseUrl: string): Client<Paths> {
  const client = createClient<Paths>({ baseUrl })
  client.use(networkFailures)
  return client
}

// openapi-fetch calls onError only when the fetch call itself rejects, so a
// TypeError here is the network failing, not a TypeError thrown while building
// the request. Any other rejection, such as the AbortError of a cancelled
// query, is rethrown unchanged, so TanStack Query still sees the cancellation.
const networkFailures: Middleware = {
  onError({ error }) {
    if (error instanceof TypeError) {
      return new ApiError({ kind: 'network' }, { cause: error })
    }
    return undefined
  },
}

// The part of an openapi-fetch result that unwrap reads.
interface FetchResult<T> {
  data?: T
  error?: unknown
  response: Response
}

// Waits for a request made with a client from createApiClient and returns its
// data, or throws an ApiError for an HTTP error response. Network failures
// already reject with an ApiError (see networkFailures).
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await request
  if (!response.ok) {
    const body = isErrorResponse(error) ? error : undefined
    throw new ApiError({
      kind: 'http',
      status: response.status,
      code: body?.code,
      fieldErrors: body?.errors ?? [],
      requestId: response.headers.get('X-Request-Id') ?? undefined,
    })
  }
  // A response without a body, such as a 204, has no data.
  return data as T
}

// openapi-fetch parses an error body as JSON when it can and returns it as
// text otherwise. Responses aren't validated (ADR 0031); this only tells the
// API's error shape apart from other bodies.
function isErrorResponse(body: unknown): body is ErrorResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    typeof body.code === 'string' &&
    (!('errors' in body) || Array.isArray(body.errors))
  )
}

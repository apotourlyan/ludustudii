// HTTP rules shared by the fake services. Each one mirrors a helper in the
// backend's internal/kit, so every fake parses requests and reports errors
// the way the real services do (ADR 0032).
import type { components } from '../schema.gen'

export type ErrorCode = components['schemas']['ErrorResponse']['code']
export type FieldError = components['schemas']['FieldError']

// The canonical form of a UUIDv7 (RFC 9562 variant): lowercase, hyphenated.
// Path IDs are lowercased before they are checked, so any letter case passes.
const CANONICAL_UUID7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// kit/validator.UUID7, applied to a path ID after strings.ToLower.
export function isUuid7(value: string): boolean {
  return CANONICAL_UUID7.test(value)
}

const INT64_MIN = -(2n ** 63n)
const INT64_MAX = 2n ** 63n - 1n

export type QueryInt = { ok: true; value: number } | { ok: false }

// kit/httpkit.BindQueryInt: a missing or empty value uses the fallback.
// Anything else must be a canonical base-10 int64 (no sign other than a
// leading minus, no leading zeros, no "-0", no white space); otherwise it is
// an invalid_integer. Range checks are the caller's.
export function parseQueryInt(value: string | null, fallback: number): QueryInt {
  if (value === null || value === '') {
    return { ok: true, value: fallback }
  }
  if (!/^(0|-?[1-9][0-9]*)$/.test(value)) {
    return { ok: false }
  }
  const parsed = BigInt(value)
  if (parsed < INT64_MIN || parsed > INT64_MAX) {
    return { ok: false }
  }
  // Values beyond Number's safe range are far outside any limit; they only
  // need to stay out of range, which Number keeps them.
  return { ok: true, value: Number(parsed) }
}

// kit/validator.IntRange.
export function intRange(
  field: string,
  value: number,
  min: number,
  max: number,
): FieldError | undefined {
  return value < min || value > max ? { field, code: 'out_of_range' } : undefined
}

// kit/etag.ParseVersion over the request's If-Match: exactly one strong,
// quoted, positive decimal int64. Leading zeros are accepted, as by the
// backend. Missing values, wildcards, lists and weak tags return undefined,
// which handlers report as 428 precondition_required.
export function parseIfMatch(value: string | null): number | undefined {
  const digits = value?.match(/^"([0-9]+)"$/)?.[1]
  if (digits === undefined) {
    return undefined
  }
  const version = BigInt(digits)
  if (version < 1n || version > INT64_MAX) {
    return undefined
  }
  return Number(version)
}

// kit/etag.Format.
export function etag(version: number): string {
  return `"${version}"`
}

const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const GENERATED_ID_LENGTH = 26

// kit/httpkit.RequestID: the incoming X-Request-Id when it is 1–128 ASCII
// letters, digits, dots, underscores or hyphens, otherwise a random base32
// ID like Go's crypto/rand.Text.
export function requestId(request: Request): string {
  const incoming = request.headers.get('X-Request-Id')
  if (incoming !== null && REQUEST_ID.test(incoming)) {
    return incoming
  }
  const bytes = crypto.getRandomValues(new Uint8Array(GENERATED_ID_LENGTH))
  return Array.from(bytes, (byte) => BASE32_ALPHABET[byte % 32]).join('')
}

// Reads a JSON request body as kit/httpkit.BindJSON does for the fields
// the fakes use: an empty body binds nothing, so every field is empty, and
// a missing or null field is empty too. Anything the backend would reject
// with bind_error can't be sent by the typed client, so the fakes throw
// instead of answering it (see each service's handlers).
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (text === '') {
    return {}
  }
  const body: unknown = JSON.parse(text)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('fake backend: a request body that is not a JSON object is not supported')
  }
  return body as Record<string, unknown>
}

// A string field of a body read with readJsonObject.
export function stringField(body: Record<string, unknown>, name: string): string {
  const value = body[name]
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value !== 'string') {
    throw new Error(`fake backend: a non-string "${name}" is not supported`)
  }
  return value
}

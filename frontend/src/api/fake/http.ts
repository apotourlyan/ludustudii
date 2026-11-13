// HTTP pieces shared by the fake services (ADR 0032).
import type { components } from '../schema.gen'

export type FieldError = components['schemas']['FieldError']

const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// Whether a lowercased path ID is a UUIDv7.
export function isUuid7(id: string): boolean {
  return UUID7.test(id)
}

// The version in an If-Match of the form "<digits>", or undefined for
// anything else, which handlers answer with 428.
export function ifMatchVersion(request: Request): number | undefined {
  const digits = request.headers.get('If-Match')?.match(/^"([0-9]+)"$/)?.[1]
  return digits === undefined ? undefined : Number(digits)
}

// The strong ETag for a version.
export function etag(version: number): string {
  return `"${version}"`
}

// The X-Request-Id header every response carries.
export function requestIdHeader(): { 'X-Request-Id': string } {
  return { 'X-Request-Id': crypto.randomUUID() }
}

export function validationError(errors: FieldError[]) {
  return { code: 'validation_error' as const, errors }
}

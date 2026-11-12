// Text input rules shared by the fake services, mirroring the backend's
// kit/sanitizer and kit/validator (ADR 0008).
import type { FieldError } from './http'

// The characters Go's strings.TrimSpace removes (unicode.IsSpace). JS
// trim() differs: it also strips U+FEFF and keeps U+0085.
const GO_SPACE = '\\t\\n\\v\\f\\r \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000'
const LEADING_SPACE = new RegExp(`^[${GO_SPACE}]+`, 'u')
const TRAILING_SPACE = new RegExp(`[${GO_SPACE}]+$`, 'u')

function trimSpace(value: string): string {
  return value.replace(LEADING_SPACE, '').replace(TRAILING_SPACE, '')
}

// kit/sanitizer.String: NFC, then trimmed. Lone surrogates become U+FFFD
// first, as Go's JSON decoder does when it reads them.
export function sanitizeText(value: string): string {
  return trimSpace(value.toWellFormed().normalize('NFC'))
}

// kit/validator.MaxLengthText: trimmed, NFC, not empty and at most
// maxLength code points; the first failed check is reported.
export function validateText(
  field: string,
  value: string,
  maxLength: number,
): FieldError | undefined {
  if (value !== trimSpace(value)) {
    return { field, code: 'untrimmed' }
  }
  if (value !== value.normalize('NFC')) {
    return { field, code: 'not_normalized' }
  }
  if (value === '') {
    return { field, code: 'required' }
  }
  if ([...value].length > maxLength) {
    return { field, code: 'max_length' }
  }
  return undefined
}

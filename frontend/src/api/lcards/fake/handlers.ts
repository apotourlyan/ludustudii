// The fake lcards service's HTTP layer (ADR 0032): openapi-msw handlers for
// the operations the client app uses, typed against the generated spec
// types, over the in-memory store.
//
// Each handler checks a request in the same order as its backend handler in
// backend/internal/services/lcards/{list,create,get,update,remove}:
//
//   GET    /api/lcards       limit (invalid_integer stops here), then limit
//                            range and cursor together
//   POST   /api/lcards       body, sanitize, title and description together
//   GET    /api/lcards/{id}  id, then lookup
//   PUT    /api/lcards/{id}  id, If-Match (428), body, sanitize, title and
//                            description, then lookup (404 before 412)
//   DELETE /api/lcards/{id}  id, If-Match (428), then lookup (404 before 412)
//
// Left out, because the client app can't cause them:
//   - HEAD on the collection and on a card;
//   - 413 payload_too_large (bodies over 1 MiB);
//   - 415 unsupported_media_type (bodies that aren't application/json);
//   - 400 bind_error (malformed JSON, non-object bodies, fields of the wrong
//     type, trailing data). The fake throws on what it can't read, so MSW
//     fails the request instead of answering it wrongly. Unknown fields are
//     ignored, as the spec's request body description says; the backend
//     rejects them with bind_error, and the spec is to be corrected (#16);
//   - 405 method_not_allowed and 404 for unknown /api paths: those requests
//     match no handler and fail as unhandled.
//
// Cursors are the store's own tokens. Unlike the backend, which accepts any
// UUIDv7 as a cursor and in any letter case, the fake rejects every cursor
// it didn't hand out exactly; the spec says to pass cursors unchanged.
import { createOpenApiHttp } from 'openapi-msw'
import type { paths } from '../../schema.gen'
import {
  etag,
  intRange,
  isUuid7,
  parseIfMatch,
  parseQueryInt,
  readJsonObject,
  requestId,
  stringField,
  type FieldError,
} from '../../fake/http'
import { sanitizeText, validateText } from '../../fake/text'
import { cardStore, type CardContent, type CardStore } from './store'

// backend/internal/services/lcards/domain.
const CARDS_PATH = '/api/lcards'
const TITLE_MAX_LENGTH = 200
const DESCRIPTION_MAX_LENGTH = 2000
const LIST_DEFAULT_LIMIT = 20
const LIST_MIN_LIMIT = 1
const LIST_MAX_LIMIT = 100

// The handlers for the lcards service at baseUrl (apiBaseUrls.lcards),
// answering from the store.
export function lcardsHandlers(baseUrl: string, store: CardStore = cardStore) {
  const http = createOpenApiHttp<paths>({ baseUrl })

  return [
    http.get('/api/lcards', ({ request, response }) => {
      const headers = { 'X-Request-Id': requestId(request) }
      const query = new URL(request.url).searchParams

      const limit = parseQueryInt(query.get('limit'), LIST_DEFAULT_LIMIT)
      if (!limit.ok) {
        return response(400).json(
          validationError([{ field: 'limit', code: 'invalid_integer' }]),
          { headers },
        )
      }

      const cursor = query.get('cursor') ?? ''
      const errors = compact([
        intRange('limit', limit.value, LIST_MIN_LIMIT, LIST_MAX_LIMIT),
        cursor === '' || store.isCursor(cursor)
          ? undefined
          : { field: 'cursor', code: 'invalid_cursor' },
      ])
      if (errors.length > 0) {
        return response(400).json(validationError(errors), { headers })
      }

      const page = store.list({
        limit: limit.value,
        cursor: cursor === '' ? undefined : cursor,
      })
      return response(200).json(
        { items: page.items, next_cursor: page.nextCursor },
        { headers },
      )
    }),

    http.post('/api/lcards', async ({ request, response }) => {
      const headers = { 'X-Request-Id': requestId(request) }

      const content = sanitize(await readContent(request))
      const errors = validateContent(content)
      if (errors.length > 0) {
        return response(400).json(validationError(errors), { headers })
      }

      const card = store.create(content)
      return response(201).json(
        { id: card.id },
        {
          headers: {
            ...headers,
            ETag: etag(card.version),
            Location: `${CARDS_PATH}/${card.id}`,
          },
        },
      )
    }),

    http.get('/api/lcards/{id}', ({ params, request, response }) => {
      const headers = { 'X-Request-Id': requestId(request) }

      const id = params.id.toLowerCase()
      if (!isUuid7(id)) {
        return response(400).json(invalidId, { headers })
      }

      const card = store.get(id)
      if (!card) {
        return response(404).json({ code: 'not_found' }, { headers })
      }
      return response(200).json(card, {
        headers: { ...headers, ETag: etag(card.version) },
      })
    }),

    http.put('/api/lcards/{id}', async ({ params, request, response }) => {
      const headers = { 'X-Request-Id': requestId(request) }

      const id = params.id.toLowerCase()
      if (!isUuid7(id)) {
        return response(400).json(invalidId, { headers })
      }

      const version = parseIfMatch(request.headers.get('If-Match'))
      if (version === undefined) {
        return response(428).json({ code: 'precondition_required' }, { headers })
      }

      const content = sanitize(await readContent(request))
      const errors = validateContent(content)
      if (errors.length > 0) {
        return response(400).json(validationError(errors), { headers })
      }

      const result = store.replace(id, version, content)
      switch (result.outcome) {
        case 'not_found':
          return response(404).json({ code: 'not_found' }, { headers })
        case 'stale':
          return response(412).json({ code: 'precondition_failed' }, { headers })
        case 'replaced':
          return response(204).empty({
            headers: { ...headers, ETag: etag(result.version) },
          })
      }
    }),

    http.delete('/api/lcards/{id}', ({ params, request, response }) => {
      const headers = { 'X-Request-Id': requestId(request) }

      const id = params.id.toLowerCase()
      if (!isUuid7(id)) {
        return response(400).json(invalidId, { headers })
      }

      const version = parseIfMatch(request.headers.get('If-Match'))
      if (version === undefined) {
        return response(428).json({ code: 'precondition_required' }, { headers })
      }

      const result = store.remove(id, version)
      switch (result.outcome) {
        case 'not_found':
          return response(404).json({ code: 'not_found' }, { headers })
        case 'stale':
          return response(412).json({ code: 'precondition_failed' }, { headers })
        case 'removed':
          return response(204).empty({ headers })
      }
    }),
  ]
}

const invalidId = validationError([{ field: 'id', code: 'invalid_uuid7' }])

function validationError(errors: FieldError[]) {
  return { code: 'validation_error' as const, errors }
}

function compact(errors: (FieldError | undefined)[]): FieldError[] {
  return errors.filter((error) => error !== undefined)
}

async function readContent(request: Request): Promise<CardContent> {
  const body = await readJsonObject(request)
  return {
    title: stringField(body, 'title'),
    description: stringField(body, 'description'),
  }
}

function sanitize({ title, description }: CardContent): CardContent {
  return { title: sanitizeText(title), description: sanitizeText(description) }
}

// Both fields are checked, title first, so one response reports both.
function validateContent({ title, description }: CardContent): FieldError[] {
  return compact([
    validateText('title', title, TITLE_MAX_LENGTH),
    validateText('description', description, DESCRIPTION_MAX_LENGTH),
  ])
}

// The fake lcards service's HTTP layer (ADR 0032): openapi-msw handlers,
// typed against the generated spec types, that map requests to the store
// and its outcomes to responses. They implement only what the client app's
// flows depend on; a test that needs any other response overrides a
// handler.
//
// Operations: GET and POST /api/lcards, and GET, PUT and DELETE
// /api/lcards/{id}.
import { createOpenApiHttp } from 'openapi-msw'
import type { paths } from '../../schema.gen'
import {
  etag,
  ifMatchVersion,
  isUuid7,
  requestIdHeader,
  validationError,
  type FieldError,
} from '../../fake/http'
import { cardStore, type CardContent, type CardStore } from './store'

const CARDS_PATH = '/api/lcards'
const TITLE_MAX_LENGTH = 200
const DESCRIPTION_MAX_LENGTH = 2000
const LIST_DEFAULT_LIMIT = 20
const LIST_MAX_LIMIT = 100

const invalidId = validationError([{ field: 'id', code: 'invalid_uuid7' }])

// The handlers for the lcards service at baseUrl (apiBaseUrls.lcards),
// answering from the store.
export function lcardsHandlers(baseUrl: string, store: CardStore = cardStore) {
  const http = createOpenApiHttp<paths>({ baseUrl })

  return [
    http.get('/api/lcards', ({ request, response }) => {
      const headers = requestIdHeader()
      const query = new URL(request.url).searchParams
      const limit = Number(query.get('limit') || LIST_DEFAULT_LIMIT)
      const cursor = query.get('cursor') || undefined

      const errors: FieldError[] = []
      if (!Number.isInteger(limit) || limit < 1 || limit > LIST_MAX_LIMIT) {
        errors.push({ field: 'limit', code: 'out_of_range' })
      }
      if (cursor !== undefined && !store.isCursor(cursor)) {
        errors.push({ field: 'cursor', code: 'invalid_cursor' })
      }
      if (errors.length > 0) {
        return response(400).json(validationError(errors), { headers })
      }

      const page = store.list({ limit, cursor })
      return response(200).json(
        { items: page.items, next_cursor: page.nextCursor },
        { headers },
      )
    }),

    http.post('/api/lcards', async ({ request, response }) => {
      const headers = requestIdHeader()

      const content = trimmed(await request.json())
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

    http.get('/api/lcards/{id}', ({ params, response }) => {
      const headers = requestIdHeader()

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
      const headers = requestIdHeader()

      const id = params.id.toLowerCase()
      if (!isUuid7(id)) {
        return response(400).json(invalidId, { headers })
      }

      const version = ifMatchVersion(request)
      if (version === undefined) {
        return response(428).json({ code: 'precondition_required' }, { headers })
      }

      const content = trimmed(await request.json())
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
      const headers = requestIdHeader()

      const id = params.id.toLowerCase()
      if (!isUuid7(id)) {
        return response(400).json(invalidId, { headers })
      }

      const version = ifMatchVersion(request)
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

function trimmed({ title, description }: CardContent): CardContent {
  return { title: title.trim(), description: description.trim() }
}

// Both fields are checked, title first, so one response reports both.
function validateContent({ title, description }: CardContent): FieldError[] {
  return [
    validateText('title', title, TITLE_MAX_LENGTH),
    validateText('description', description, DESCRIPTION_MAX_LENGTH),
  ].filter((error) => error !== undefined)
}

// A trimmed text is required and at most maxLength code points.
function validateText(
  field: string,
  value: string,
  maxLength: number,
): FieldError | undefined {
  if (value === '') {
    return { field, code: 'required' }
  }
  if ([...value].length > maxLength) {
    return { field, code: 'max_length' }
  }
  return undefined
}

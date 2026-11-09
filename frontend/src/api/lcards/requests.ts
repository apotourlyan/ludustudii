import { HttpError } from '../http-error'

export interface CreateLearningCardRequest {
  title: string
  description: string
}

export interface CreateLearningCardResponse {
  id: string
}

export interface UpdateLearningCardRequest {
  version: number
  id: string
  title: string
  description: string
}

export interface LearningCard {
  version: number
  id: string
  title: string
  description: string
}

export async function createLearningCard(
  payload: CreateLearningCardRequest,
): Promise<CreateLearningCardResponse> {
  const response = await fetch('/api/lcards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Failed to create learning card: ${response.statusText}`,
    )
  }

  return response.json()
}

export async function updateLearningCard({
  id,
  version,
  title,
  description,
}: UpdateLearningCardRequest): Promise<void> {
  const response = await fetch(`/api/lcards/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': `"${version}"`,
    },
    body: JSON.stringify({ title, description }),
  })

  if (response.status === 412) {
    throw new HttpError(
      response.status,
      'This card has changed. Reload it before saving your edits.',
    )
  }
  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Failed to update learning card: ${response.statusText}`,
    )
  }
}

// Expected delete endpoint contract: DELETE /api/lcards/:id returns no content.
export async function deleteLearningCard({
  id,
  version,
}: Pick<LearningCard, 'id' | 'version'>): Promise<void> {
  const response = await fetch(`/api/lcards/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'If-Match': `"${version}"` },
  })

  if (response.status === 412) {
    throw new HttpError(
      response.status,
      'This card has changed. Reload it before deleting.',
    )
  }
  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Failed to delete learning card: ${response.statusText}`,
    )
  }
}

export async function getLearningCard(id: string): Promise<LearningCard> {
  const response = await fetch(`/api/lcards/${encodeURIComponent(id)}`)

  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Failed to load learning card: ${response.statusText}`,
    )
  }

  return response.json()
}

// Expected list endpoint contract: GET /api/lcards returns
// { items: LearningCard[], next_cursor: string | null }.
// Only the first page is loaded; next_cursor is not followed yet.
export async function getLearningCards(signal?: AbortSignal): Promise<LearningCard[]> {
  const response = await fetch('/api/lcards', { signal })

  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Failed to load learning cards: ${response.statusText}`,
    )
  }

  const page: unknown = await response.json()
  if (
    typeof page !== 'object' ||
    page === null ||
    !('items' in page) ||
    !Array.isArray(page.items)
  ) {
    throw new Error('Expected a page of learning cards')
  }

  return page.items
}

import { apiBaseUrls } from "../config";
import { createApiClient, unwrap } from "../http";
import type { components, paths } from "../schema.gen";

type Schemas = components["schemas"];

export type LearningCard = Schemas["LearningCard"];
export type CreateLearningCardRequest = Schemas["LearningCardInput"];
export type CreateLearningCardResponse = Schemas["CreatedLearningCard"];
// The card to replace, and its new title and description.
export type UpdateLearningCardRequest = Pick<LearningCard, "id"> & Schemas["LearningCardInput"];

const client = createApiClient<paths>(apiBaseUrls.lcards);

export function createLearningCard(
  body: CreateLearningCardRequest,
): Promise<CreateLearningCardResponse> {
  return unwrap(client.POST("/api/lcards", { body }));
}

export async function updateLearningCard({
  id,
  title,
  description,
}: UpdateLearningCardRequest): Promise<void> {
  await unwrap(
    client.PUT("/api/lcards/{id}", {
      params: { path: { id } },
      body: { title, description },
    }),
  );
}

export async function deleteLearningCard({ id }: Pick<LearningCard, "id">): Promise<void> {
  await unwrap(client.DELETE("/api/lcards/{id}", { params: { path: { id } } }));
}

export function getLearningCard(id: string, signal?: AbortSignal): Promise<LearningCard> {
  return unwrap(client.GET("/api/lcards/{id}", { params: { path: { id } }, signal }));
}

// The largest page the API serves (its limit's maximum).
const LIST_PAGE_SIZE = 100;

// Only the first page is loaded, as large as the API allows; next_cursor
// is not followed yet.
export async function getLearningCards(signal?: AbortSignal): Promise<LearningCard[]> {
  const page = await unwrap(
    client.GET("/api/lcards", { params: { query: { limit: LIST_PAGE_SIZE } }, signal }),
  );
  return page.items;
}

import { apiBaseUrls } from "../config";
import { createApiClient, unwrap } from "../http";
import type { components, paths } from "../schema.gen";

type Schemas = components["schemas"];

export type LearningCard = Schemas["LearningCard"];
export type CreateLearningCardRequest = Schemas["LearningCardInput"];
export type CreateLearningCardResponse = Schemas["CreatedLearningCard"];
// The card to replace, at the version the edit started from, and its new
// title and description.
export type UpdateLearningCardRequest = Pick<LearningCard, "id" | "version"> &
  Schemas["LearningCardInput"];

const client = createApiClient<paths>(apiBaseUrls.lcards);

// If-Match takes the version as a strong ETag: the number in double quotes
// (ADR 0010).
const ifMatch = (version: number) => `"${version}"`;

export function createLearningCard(
  body: CreateLearningCardRequest,
): Promise<CreateLearningCardResponse> {
  return unwrap(client.POST("/api/lcards", { body }));
}

export async function updateLearningCard({
  id,
  version,
  title,
  description,
}: UpdateLearningCardRequest): Promise<void> {
  await unwrap(
    client.PUT("/api/lcards/{id}", {
      params: { path: { id }, header: { "If-Match": ifMatch(version) } },
      body: { title, description },
    }),
  );
}

export async function deleteLearningCard({
  id,
  version,
}: Pick<LearningCard, "id" | "version">): Promise<void> {
  await unwrap(
    client.DELETE("/api/lcards/{id}", {
      params: { path: { id }, header: { "If-Match": ifMatch(version) } },
    }),
  );
}

export function getLearningCard(id: string, signal?: AbortSignal): Promise<LearningCard> {
  return unwrap(client.GET("/api/lcards/{id}", { params: { path: { id } }, signal }));
}

// Only the first page is loaded; next_cursor is not followed yet.
export async function getLearningCards(signal?: AbortSignal): Promise<LearningCard[]> {
  const page = await unwrap(client.GET("/api/lcards", { signal }));
  return page.items;
}

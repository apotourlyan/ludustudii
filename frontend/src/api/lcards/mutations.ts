import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { ApiError } from "../http";
import { lcardKeys } from "./queries";
import { createLearningCard, deleteLearningCard, updateLearningCard } from "./requests";

// The mutations don't wait for their invalidations: a mutation settles as soon
// as the server answers, and the UI navigates or resets at once while the
// invalidated queries refetch in the background (ADR 0030). The promises
// never reject; a failed refetch keeps the old data.

export function useCreateLearningCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLearningCard,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
    },
  });
}

export function useUpdateLearningCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLearningCard,
    onSuccess: (_data, { id }) => invalidateCard(queryClient, id),
    onError: (error, { id }) => invalidateIfNotFound(queryClient, error, id),
  });
}

export function useDeleteLearningCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLearningCard,
    onSuccess: (_data, { id }) => {
      // Drop the deleted card's cache entry so it is not refetched into a 404.
      queryClient.removeQueries({ queryKey: lcardKeys.detail(id), exact: true });
      void queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
    },
    onError: (error, { id }) => invalidateIfNotFound(queryClient, error, id),
  });
}

// Marks the card's list and detail queries stale, refetching those on screen.
function invalidateCard(queryClient: QueryClient, id: string): void {
  void queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: lcardKeys.detail(id) });
}

// A 404 from a write means the card was deleted elsewhere. The mutation
// still fails, so its error is shown (a notification later, ADR 0038), and
// the card's queries refetch, so the list stops showing it.
function invalidateIfNotFound(queryClient: QueryClient, error: Error, id: string): void {
  if (error instanceof ApiError && error.failure.kind === "http" && error.failure.status === 404) {
    invalidateCard(queryClient, id);
  }
}

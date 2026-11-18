import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { ApiError } from "../http";
import { lcardKeys } from "./queries";
import { createLearningCard, deleteLearningCard, updateLearningCard } from "./requests";

// The mutations don't wait for their invalidations: a mutation settles as soon
// as the server answers, and the UI navigates or resets at once while the
// invalidated queries refetch in the background (ADR 0030). The promises
// never reject; a failed refetch keeps the old data.

// Marks a card and the lists that show it as stale, so the next read
// fetches them, and the queries a page shows refetch now.
function invalidateCard(queryClient: QueryClient, id: string) {
  void queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: lcardKeys.detail(id) });
}

// A 412: the card changed since the version the request sent (ADR 0010),
// so the cached copy is out of date, however fresh it counts as.
function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.failure.kind === "http" && error.failure.status === 412;
}

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
    onError: (error, { id }) => {
      if (isConflict(error)) {
        invalidateCard(queryClient, id);
      }
    },
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
    onError: (error, { id }) => {
      if (isConflict(error)) {
        invalidateCard(queryClient, id);
      }
    },
  });
}

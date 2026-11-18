import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../http";
import { lcardKeys } from "./queries";
import {
  createLearningCard,
  deleteLearningCard,
  updateLearningCard,
  type LearningCard,
} from "./requests";

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

  // The card's cached copies are refetched after a save, and after a 404:
  // the card was deleted elsewhere, so the list drops it and its page shows
  // the not-found page. Its editor stays on screen with the error; a failed
  // refetch keeps the copy it shows.
  function refetchCard(id: string) {
    void queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: lcardKeys.detail(id) });
  }

  return useMutation({
    mutationFn: updateLearningCard,
    onSuccess: (_data, { id }) => refetchCard(id),
    onError: (error, { id }) => {
      if (isNotFound(error)) refetchCard(id);
    },
  });
}

export function useDeleteLearningCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMissingOk,
    onSuccess: (_data, { id }) => {
      // Drop the deleted card's cache entry so it is not refetched into a 404.
      queryClient.removeQueries({ queryKey: lcardKeys.detail(id), exact: true });
      void queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
    },
  });
}

// Deletes the card. A 404 means it is already gone, deleted elsewhere, which
// is what the delete wanted: it resolves, so the cached copies are dropped
// as after any delete, instead of failing while the list still shows it.
async function deleteMissingOk(card: Pick<LearningCard, "id">): Promise<void> {
  try {
    await deleteLearningCard(card);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

// The card the request names doesn't exist.
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.failure.kind === "http" && error.failure.status === 404;
}

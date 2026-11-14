import { useMutation, useQueryClient } from "@tanstack/react-query";
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
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: lcardKeys.detail(id) });
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
  });
}

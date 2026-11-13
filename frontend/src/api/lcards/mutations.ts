import { useMutation, useQueryClient } from "@tanstack/react-query";
import { lcardKeys } from "./queries";
import { createLearningCard, deleteLearningCard, updateLearningCard } from "./requests";

export function useCreateLearningCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLearningCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
    },
  });
}

export function useUpdateLearningCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLearningCard,
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
      queryClient.invalidateQueries({ queryKey: lcardKeys.detail(id) });
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
      queryClient.invalidateQueries({ queryKey: lcardKeys.lists() });
    },
  });
}

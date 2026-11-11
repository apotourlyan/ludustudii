import { useMutation, useQueryClient } from '@tanstack/react-query'
import { lcardKeys } from './queries'
import {
  createLearningCard,
  deleteLearningCard,
  updateLearningCard,
  type CreateLearningCardRequest,
  type LearningCard,
  type UpdateLearningCardRequest,
} from './requests'

// Each mutationFn wraps its request function, because TanStack Query passes
// a context as the second argument, where the request functions take an
// abort signal. Mutations aren't cancelled, so they pass no signal.

export function useCreateLearningCard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (card: CreateLearningCardRequest) => createLearningCard(card),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lcardKeys.lists() })
    },
  })
}

export function useUpdateLearningCard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (card: UpdateLearningCardRequest) => updateLearningCard(card),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: lcardKeys.lists() })
      queryClient.invalidateQueries({ queryKey: lcardKeys.detail(id) })
    },
  })
}

export function useDeleteLearningCard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (card: Pick<LearningCard, 'id' | 'version'>) =>
      deleteLearningCard(card),
    onSuccess: (_data, { id }) => {
      // Drop the deleted card's cache entry so it is not refetched into a 404.
      queryClient.removeQueries({ queryKey: lcardKeys.detail(id), exact: true })
      queryClient.invalidateQueries({ queryKey: lcardKeys.lists() })
    },
  })
}

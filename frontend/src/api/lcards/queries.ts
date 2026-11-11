import { queryOptions } from '@tanstack/react-query'
import { getLearningCard, getLearningCards } from './requests'

// Every key starts with the backend service name, so one resource has one
// cache entry whichever screen reads it. Other services' mutations may import
// this factory to invalidate learning cards.
export const lcardKeys = {
  all: ['lcards'] as const,
  lists: () => [...lcardKeys.all, 'list'] as const,
  detail: (id: string) => [...lcardKeys.all, 'detail', id] as const,
}

export const lcardQueries = {
  list: () =>
    queryOptions({
      queryKey: lcardKeys.lists(),
      queryFn: ({ signal }) => getLearningCards(signal),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: lcardKeys.detail(id),
      queryFn: ({ signal }) => getLearningCard(id, signal),
    }),
}

import { createFileRoute } from '@tanstack/react-router'
import { lcardQueries } from '@/api/lcards'
import { LearningCardsOverview } from '@/components/learning-cards-overview'

export const Route = createFileRoute('/learning-cards')({
  // 'static' returns cached data as is; useSuspenseQuery refetches it if stale.
  loader: ({ context: { queryClient } }) =>
    queryClient.query({ ...lcardQueries.list(), staleTime: 'static' }),
  component: LearningCardsOverview,
})

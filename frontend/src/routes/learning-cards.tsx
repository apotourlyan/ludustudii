import { createFileRoute } from '@tanstack/react-router'
import { lcardQueries } from '@/api/lcards'
import { LearningCardsOverview } from '@/components/learning-cards-overview'

export const Route = createFileRoute('/learning-cards')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(lcardQueries.list()),
  component: LearningCardsOverview,
})

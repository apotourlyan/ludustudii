import { createFileRoute } from '@tanstack/react-router'
import { lcardQueries } from '@/api/lcards'
import { LearningCardsOverview } from '@/components/learning-cards-overview'

export const Route = createFileRoute('/learning-cards')({
  loader: ({ context: { queryClient } }) =>
    queryClient.query(lcardQueries.list()),
  component: LearningCardsOverview,
})

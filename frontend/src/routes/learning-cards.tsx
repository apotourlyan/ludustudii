import { createFileRoute } from '@tanstack/react-router'
import { lcardQueries } from '@/api/lcards'
import { LearningCardsOverview } from '@/components/learning-cards-overview'

export const Route = createFileRoute('/learning-cards')({
  // Fill the query cache without returning the data, so the router keeps no
  // second copy as loaderData.
  loader: async ({ context: { queryClient } }) => {
    await queryClient.query(lcardQueries.list())
  },
  component: LearningCardsOverview,
})

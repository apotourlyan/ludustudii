import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { lcardQueries } from '@/api/lcards'
import { LearningCardForm } from '@/components/learning-card-form'

export const Route = createFileRoute('/learning-card_/$cardId')({
  // 'static' returns cached data as is; useSuspenseQuery refetches it if stale.
  loader: ({ context: { queryClient }, params: { cardId } }) =>
    queryClient.query({ ...lcardQueries.detail(cardId), staleTime: 'static' }),
  component: LearningCardEditRoute,
})

function LearningCardEditRoute() {
  const { cardId } = Route.useParams()
  const { data: card } = useSuspenseQuery(lcardQueries.detail(cardId))

  return <LearningCardForm key={card.id} card={card} />
}

import { useEffect } from 'react'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'

// The router's default error component, shown when a route's loader or a
// suspense query in its component fails.
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  // Let queries that failed inside this boundary fetch again on the next render.
  useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

  const message = error instanceof Error ? error.message : String(error)

  return (
    <div className="mx-auto max-w-xl p-6">
      <Card>
        <CardContent className="space-y-3">
          <FieldError>{message}</FieldError>
          <Button variant="outline" onClick={() => router.invalidate()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

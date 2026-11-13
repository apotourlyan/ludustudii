// The router's default pending component, shown while a route's loader runs
// for longer than the router's pendingMs.
export function RoutePending() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <span role="status" className="text-muted-foreground">Loading...</span>
    </div>
  )
}

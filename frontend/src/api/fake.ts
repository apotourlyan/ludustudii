// The fake backend (ADR 0032): every service's fake handlers, at the same
// base URLs as the real clients, and a way to reset every fake store.
// Nothing here depends on the browser, so tests can run the fake in Node.
import type { RequestHandler } from 'msw'
import { apiBaseUrls } from './config'
import { lcardsHandlers } from './lcards/fake/handlers'
import { cardStore } from './lcards/fake/store'

export const fakeHandlers: readonly RequestHandler[] = [
  ...lcardsHandlers(apiBaseUrls.lcards),
]

// Empties every fake store.
export function resetFakeStores(): void {
  cardStore.reset()
}

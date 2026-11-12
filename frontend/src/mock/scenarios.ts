// Seeded scenarios for the fake backend (ADR 0032), chosen in the mock mode
// with the app URL's `scenario` parameter. Nothing here depends on the
// browser, so tests can use the same scenarios in Node.
import { delay, http, HttpResponse, type RequestHandler } from 'msw'
import { apiBaseUrls } from '@/api/config'
import { requestId } from '@/api/fake/http'
import { resetFakeStores } from '@/api/fake'
import { makeCards, sampleCards } from '@/api/lcards/fake/factories'
import { cardStore } from '@/api/lcards/fake/store'

// Every service's API paths, for handlers that apply to every API request.
const apiPaths = [...new Set(Object.values(apiBaseUrls))].map((base) => `${base}/api/*`)

// More cards than the largest page (100), so listing them takes pages.
const MANY_CARDS = 150

export const scenarios = {
  // A small library of realistic cards.
  default: () => {
    resetFakeStores()
    cardStore.seed(sampleCards())
    return []
  },
  // No cards.
  empty: () => {
    resetFakeStores()
    return []
  },
  // More cards than fit on one page.
  many: () => {
    resetFakeStores()
    cardStore.seed(
      makeCards(MANY_CARDS, (index) => ({
        title: `Card ${index + 1} of ${MANY_CARDS}`,
        description: `Card number **${index + 1}**, created after card ${index}.`,
      })),
    )
    return []
  },
  // Every API request fails with a server error.
  failing: () => {
    resetFakeStores()
    return failingHandlers()
  },
} satisfies Record<string, () => RequestHandler[]>

export type ScenarioName = keyof typeof scenarios

export function isScenarioName(name: string): name is ScenarioName {
  return Object.hasOwn(scenarios, name)
}

// Resets every fake store, seeds it for the scenario and returns the
// handlers the scenario needs ahead of the fake's own.
export function applyScenario(name: ScenarioName): RequestHandler[] {
  return scenarios[name]()
}

// Answers every API request with 500 unexpected_error, the way the backend
// reports a failure it can't describe.
export function failingHandlers(): RequestHandler[] {
  return apiPaths.map((path) =>
    http.all(path, ({ request }) =>
      HttpResponse.json(
        { code: 'unexpected_error' },
        { status: 500, headers: { 'X-Request-Id': requestId(request) } },
      ),
    ),
  )
}

// Delays every API request by `ms` milliseconds, then lets the next handler
// answer it. Put these before the handlers they should delay.
export function latencyHandlers(ms: number): RequestHandler[] {
  if (ms <= 0) {
    return []
  }
  return apiPaths.map((path) =>
    http.all(path, async () => {
      await delay(ms)
    }),
  )
}

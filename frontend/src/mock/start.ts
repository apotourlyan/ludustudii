// Starts the fake backend in the browser for the mock mode (npm run
// dev:mock, ADR 0032). main.tsx imports this module dynamically, and only in
// that mode, so neither MSW's worker nor the fake reaches another build.
import { network } from 'virtual:msw'
import { apiBaseUrls } from '@/api/config'
import { fakeHandlers } from '@/api/fake'
import {
  applyScenario,
  isScenarioName,
  latencyHandlers,
  scenarios,
} from './scenarios'

// Every service's API prefix, resolved against the page, to tell API
// requests the fake should have answered from everything else.
const apiPrefixes = [...new Set(Object.values(apiBaseUrls))].map(
  (base) => new URL(`${base}/api/`, window.location.href).href,
)

// Reads the scenario and the delay from the app's URL when it loads,
// seeds the fake for that scenario and starts intercepting requests. The
// state lives in memory, so reloading the page starts over.
export async function startFakeBackend(): Promise<void> {
  const params = new URL(window.location.href).searchParams
  const scenario = params.get('scenario') || 'default'
  if (!isScenarioName(scenario)) {
    throw new Error(
      `fake backend: unknown scenario "${scenario}"; use one of: ${Object.keys(scenarios).join(', ')}`,
    )
  }
  const delayMs = parseDelay(params.get('delay'))

  network.configure({
    handlers: [...latencyHandlers(delayMs), ...applyScenario(scenario), ...fakeHandlers],
    // An API request no handler answers is a gap in the fake: fail it
    // loudly instead of passing it on to a backend that isn't there.
    // Everything else (the app's modules, fonts, Vite's own requests)
    // passes through.
    onUnhandledFrame: ({ frame, defaults }) => {
      // Checked by protocol rather than with instanceof HttpNetworkFrame,
      // which fails if the worker's frames come from another copy of MSW.
      if (frame.protocol !== 'http') {
        return
      }
      const { url, method } = (frame.data as { request: Request }).request
      if (apiPrefixes.some((prefix) => url.startsWith(prefix))) {
        defaults.error()
        throw new Error(`fake backend: no handler for ${method} ${url}`)
      }
    },
  })
  await network.enable()

  console.info(
    `[fake backend] scenario "${scenario}"${delayMs > 0 ? `, ${delayMs} ms delay` : ''}`,
  )
}

function parseDelay(value: string | null): number {
  if (value === null || value === '') {
    return 0
  }
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`fake backend: delay must be milliseconds, got "${value}"`)
  }
  return Number(value)
}

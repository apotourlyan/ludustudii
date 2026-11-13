// Starts the fake backend in the browser for the mock mode (npm run
// dev:mock, ADR 0032). main.tsx imports this module dynamically, and only in
// that mode, so neither MSW's worker nor the fake reaches another build.
import { network } from 'virtual:msw'
import { fakeHandlers } from '@/api/fake'
import {
  applyScenario,
  isScenarioName,
  latencyHandlers,
  scenarios,
  unhandledApiHandlers,
} from './scenarios'

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
    handlers: [
      ...latencyHandlers(delayMs),
      ...applyScenario(scenario),
      ...fakeHandlers,
      // Last: an API request the fake has no handler for fails here
      // instead of passing through to a backend.
      ...unhandledApiHandlers(),
    ],
    // Everything else (the app's modules, fonts, Vite's own requests)
    // passes through.
    onUnhandledFrame: 'bypass',
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

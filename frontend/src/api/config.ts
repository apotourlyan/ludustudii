// The base URL of each backend service's API. The spec's paths already start
// with /api, so a service on the client app's origin has an empty base URL.
// How this is configured at runtime is decided once a service moves to
// another origin or behind a gateway (ADR 0031).
export const apiBaseUrls = {
  lcards: '',
} as const

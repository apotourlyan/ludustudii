// The app tests (ADR 0034): the client app on Vite's dev server in the mock
// mode, where the fake backend answers its API requests in the browser
// (ADR 0032). No Go server or database. Run them with `make frontend-test`.

import { defineConfig } from "@playwright/test";

import { baseConfig } from "./tests/playwright.base";

// Not 5173, so `make dev` or `make dev-mock` can keep running alongside.
const PORT = 5183;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig(baseConfig("mock"), {
  use: { baseURL },
  webServer: {
    // --strictPort fails instead of moving to the next free port, which the
    // tests wouldn't find.
    command: `npx --no-install vite --mode mock --port ${PORT} --strictPort`,
    url: baseURL,
    // Always a fresh server, never one left from another checkout or mode.
    reuseExistingServer: false,
  },
});

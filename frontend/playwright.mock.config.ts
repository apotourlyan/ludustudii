// The app tests (ADR 0034): the client app in the mock mode, where the fake
// backend answers its API requests in the browser (ADR 0032). No Go server
// or database. Run them with `make frontend-test`.

import { defineConfig } from "@playwright/test";

import { baseConfig } from "./tests/playwright.base";

// Not 5173, so `make dev` or `make dev-mock` can keep running alongside.
const PORT = 5183;
const baseURL = `http://localhost:${PORT}`;

// MOCK_BUILD=1 builds the mock mode and serves the build with vite preview
// instead of starting the dev server. CI sets it: a built page loads its
// modules as a few bundles, where the dev server transforms and serves each
// module on every page load. Locally the dev server needs no build step.
// The build goes to dist/mock, never to the binary's embedded client app.
const OUT_DIR = "dist/mock";
// --strictPort fails instead of moving to the next free port, which the
// tests wouldn't find.
const command =
  process.env.MOCK_BUILD === "1"
    ? `npx --no-install vite build --mode mock --outDir ${OUT_DIR} --emptyOutDir --logLevel warn && ` +
      `npx --no-install vite preview --mode mock --outDir ${OUT_DIR} --port ${PORT} --strictPort`
    : `npx --no-install vite --mode mock --port ${PORT} --strictPort`;

export default defineConfig(baseConfig("mock"), {
  use: { baseURL },
  webServer: {
    command,
    url: baseURL,
    // Always a fresh server, never one left from another checkout or mode.
    reuseExistingServer: false,
  },
});

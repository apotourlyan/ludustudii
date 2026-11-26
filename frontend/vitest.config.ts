// The unit and component tests (ADR 0043), run with `make frontend-unit`.
// They build with the app's Vite config, so imports, aliases and plugins
// behave as in the app, minus what only the dev server and the build use.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import { defineConfig, mergeConfig } from "vitest/config";

import appConfig from "./vite.config.ts";

// The browser tests start the fake backend with MSW's service worker, from
// the path setupWorker registers by default.
const MSW_WORKER_PATH = "/mockServiceWorker.js";

export default defineConfig((env) => {
  // The mock mode starts the fake from the app's URL through virtual:msw;
  // the browser tests start it themselves (src/test/setup.browser.ts).
  if (env.mode === "mock") {
    throw new Error("vitest: the mock mode is for `make dev-mock`; run the tests without --mode");
  }

  // The plugins and the aliases, without the dev server's settings (its
  // proxy would send an API request the fake misses to a running backend),
  // the pre-bundling settings, which leave MSW out outside the mock mode,
  // and the build's output, which tests don't write.
  const { server: _server, optimizeDeps: _optimizeDeps, build: _build, ...app } = appConfig(env);

  return mergeConfig(app, {
    test: {
      // On CI, also a JUnit report for the job summary (make test-summary).
      // Listing reporters replaces Vitest's defaults, so they are listed
      // too; the github-actions reporter keeps its failure annotations, and
      // its own job summary is off, since the JUnit one replaces it.
      ...(process.env.CI && {
        reporters: [
          "default",
          ["github-actions", { jobSummary: { enabled: false } }],
          ["junit", { outputFile: "test-results/junit/vitest.xml" }],
        ],
      }),
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            include: ["src/**/*.test.ts"],
            environment: "node",
          },
        },
        {
          extends: true,
          plugins: [mswWorkerScript()],
          // Pre-bundled up front, so the first test page doesn't find them
          // on its own and reload.
          optimizeDeps: {
            include: [
              "msw",
              "msw/browser",
              "openapi-msw",
              "vitest-browser-react",
              "vitest-browser-react/pure",
            ],
          },
          test: {
            name: "browser",
            include: ["src/**/*.test.tsx"],
            setupFiles: ["src/test/setup.browser.ts"],
            browser: {
              enabled: true,
              // The Chromium headless shell `make frontend-deps` installs
              // for the Playwright tests.
              provider: playwright(),
              headless: true,
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  });
});

// Serves MSW's worker script to the test pages. In the mock mode the
// msw/vite plugin serves it, along with virtual:msw; tests don't use that
// plugin, and need only the script.
function mswWorkerScript(): Plugin {
  const script = readFileSync(createRequire(import.meta.url).resolve("msw/mockServiceWorker.js"));
  return {
    name: "msw-worker-script",
    configureServer(server) {
      server.middlewares.use(MSW_WORKER_PATH, (_request, response) => {
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.setHeader("Cache-Control", "no-cache");
        response.end(script);
      });
    },
  };
}

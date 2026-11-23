// The unit and component tests (ADR 0043), run with `make frontend-unit`.
// They build with the app's Vite config, so imports, aliases and plugins
// behave as in the app, minus what only the dev server and the build use.

import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";

import appConfig from "./vite.config.ts";

export default defineConfig((env) => {
  // The mock mode starts the fake from the app's URL through virtual:msw;
  // tests don't run in it.
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
          test: {
            name: "browser",
            include: ["src/**/*.test.tsx"],
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

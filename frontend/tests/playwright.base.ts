// Settings both kinds of browser test share (ADR 0034). Each kind has its
// own config file, playwright.mock.config.ts and playwright.e2e.config.ts,
// because Playwright starts every web server a config declares, whichever
// project runs: one file per kind keeps the app tests from building or
// starting the Go server, and the end-to-end tests from starting Vite.

import { availableParallelism } from "node:os";

import { defineConfig, devices } from "@playwright/test";

// Each worker runs its own Chromium, which takes up to about 650 MB with
// these tests. Playwright's default of half the CPU cores can exhaust the
// memory of a machine with many cores and little memory, such as the
// devcontainer under Docker Desktop, and a renderer out of memory crashes
// its page. So half the cores, or PLAYWRIGHT_WORKERS when set (CI sets it),
// but at most one worker per GB of free memory.
// process.availableMemory() counts a container's memory limit, unlike
// os.freemem(), which reports the host's free memory.
const GB = 1024 ** 3;
const REQUESTED_WORKERS =
  Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? "", 10) ||
  Math.floor(availableParallelism() / 2);
const WORKERS = Math.max(
  1,
  Math.min(REQUESTED_WORKERS, Math.floor(process.availableMemory() / GB)),
);

// The kind of test: names the project and its output folders.
export function baseConfig(kind: "mock" | "e2e") {
  return defineConfig({
    // Paths resolve against the config file, in frontend/.
    testDir: `tests/${kind}`,
    outputDir: `test-results/${kind}`,
    fullyParallel: true,
    workers: WORKERS,
    // A test that passes only on a retry is flaky, and that must show.
    retries: 0,
    // On CI, also a JUnit report for the job summary (make test-summary).
    reporter: [
      [process.env.CI ? "line" : "list"],
      ["html", { open: "never", outputFolder: `playwright-report/${kind}` }],
      ...(process.env.CI
        ? [["junit", { outputFile: `test-results/junit/playwright-${kind}.xml` }] as const]
        : []),
    ],
    use: {
      headless: true,
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
    },
    projects: [{ name: kind, use: { ...devices["Desktop Chrome"] } }],
  });
}

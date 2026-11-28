// The end-to-end tests (ADR 0034): the built Go binary, with the client app
// embedded, against a database made for the run. `make test-e2e` builds the
// binary, creates and migrates the database, passes its URL in
// E2E_DB_CONNECTION, runs these tests and drops the database afterwards.

import { defineConfig } from "@playwright/test";

import { baseConfig } from "./tests/playwright.base";

const dbConnection = process.env.E2E_DB_CONNECTION;
if (!dbConnection) {
  throw new Error("E2E_DB_CONNECTION is not set; run the end-to-end tests with 'make test-e2e'");
}

// Not 8080, so `make dev` can keep running alongside.
const PORT = 8183;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig(baseConfig("e2e"), {
  use: { baseURL },
  webServer: {
    command: "../backend/bin/ludustudii",
    // Ready once the server answers and reaches its database.
    url: `${baseURL}/readyz`,
    // Always this run's binary on this run's database.
    reuseExistingServer: false,
    // Merged over the environment, which in the devcontainer already has
    // the development server's port and database.
    env: {
      APP_PORT: String(PORT),
      DB_CONNECTION: dbConnection,
      APP_API_DOCS: "false",
      LOG_LEVEL: "error",
      LOG_FORMAT: "text",
      // Cheap hashing, and limits no run reaches: every test registers
      // and logs in from the same address (ADR 0048).
      AUTH_ARGON2_MEMORY: "64",
      AUTH_ARGON2_ITERATIONS: "1",
      AUTH_LOGIN_IP_LIMIT: "100000/1m",
      AUTH_LOGIN_ACCOUNT_LIMIT: "100000/1m",
      AUTH_REGISTER_IP_LIMIT: "100000/1m",
    },
    // The server logs to stdout. At LOG_LEVEL=error, the expected 404s stay
    // quiet and only failures, 5xx responses among them, show in the output.
    stdout: "pipe",
    stderr: "pipe",
    // SIGTERM starts the server's graceful shutdown, so it closes its
    // connections before `make test-e2e` drops the database.
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});

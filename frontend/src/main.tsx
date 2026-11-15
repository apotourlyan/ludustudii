import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "@/app/app";

import "./styles/global.css";

// In the mock mode (npm run dev:mock), a fake backend answers the API
// requests in the browser (ADR 0032), and it must be running before the app
// sends its first request. MODE is replaced at build time, so other builds
// drop this branch, and with it the fake and MSW's worker.
async function startMockMode() {
  if (import.meta.env.MODE === "mock") {
    try {
      const { startFakeBackend } = await import("./mock/start");
      await startFakeBackend();
    } catch (error) {
      // Without the fake the app can't run, so say why on the page instead
      // of leaving it blank, and keep the error in the console.
      document.getElementById("root")!.textContent =
        `The fake backend didn't start: ${error instanceof Error ? error.message : String(error)}`;
      throw error;
    }
  }
}

// The app renders only once the fake backend, if any, is running. A failed
// start stops the module here, with the error in the console.
await startMockMode();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

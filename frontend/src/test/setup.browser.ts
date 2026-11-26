// Runs before each browser test file (vitest.config.ts): starts the fake
// backend in the test page and isolates the tests from each other (ADR
// 0043).

import { afterAll, afterEach, beforeAll } from "vitest";
import { configure } from "vitest-browser-react/pure";

import { resetFakeStores } from "@/api/fake";

import { fakeBackend } from "./fake-backend";
import { goOnline } from "./online";

// The app's styles, as main.tsx loads them, so views lay out and look as
// in the app: the virtualized list places its items, a dialog overlays.
import "../styles/global.css";

// As main.tsx renders the app.
configure({ reactStrictMode: true });

beforeAll(async () => {
  // Everything that isn't an API request, such as the modules Vite serves,
  // passes through; unhandledApiHandlers catches the API requests.
  await fakeBackend.start({ quiet: true, onUnhandledFrame: "bypass" });
});

// What a test seeded or changed doesn't reach the next one. Each test
// renders with its own query client (render.tsx), and vitest-browser-react
// unmounts what the last one rendered.
afterEach(() => {
  fakeBackend.resetHandlers();
  resetFakeStores();
  goOnline();
});

afterAll(async () => {
  await fakeBackend.stop();
});

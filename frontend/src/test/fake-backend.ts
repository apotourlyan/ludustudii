// The fake backend in the browser tests' page (ADR 0043): the fake's
// handlers (ADR 0032) behind MSW's service worker, as in the mock mode, but
// started by src/test/setup.browser.ts rather than from the app's URL. A
// test changes what it answers with fakeBackend.use(...), and seeds its
// stores through the fake's own modules; both are reset after each test.

import { setupWorker } from "msw/browser";

import { fakeHandlers } from "@/api/fake";
import { unhandledApiHandlers } from "@/mock/scenarios";

// Last, an API request the fake has no handler for fails as a network
// error, with the request named in the console, instead of reaching a
// server.
export const fakeBackend = setupWorker(...fakeHandlers, ...unhandledApiHandlers());

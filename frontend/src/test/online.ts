// Whether TanStack Query takes the browser to be online, for a test of
// what a request does while it is offline. setup.browser.ts sets it back
// online after each test.

import { onlineManager } from "@tanstack/react-query";

// As the browser's offline event does.
export function goOffline(): void {
  onlineManager.setOnline(false);
}

export function goOnline(): void {
  onlineManager.setOnline(true);
}

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { useNow } from "./use-now";

const START = Date.parse("2026-11-23T12:00:00.000Z");
const MINUTE = 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ now: START });
});

afterEach(() => {
  vi.useRealTimers();
});

test("starts at the current time", async () => {
  const { result } = await renderHook(() => useNow());

  expect(result.current).toBe(START);
});

// The component re-renders with the new time; between ticks it keeps the
// time of the last one. (React's StrictMode, which the tests use as the app
// does, renders twice per update, so the renders aren't counted.)
test("re-renders with the time each minute, and keeps it in between", async () => {
  const { result, act } = await renderHook(() => useNow());

  await act(() => vi.advanceTimersByTime(MINUTE - 1));
  expect(result.current).toBe(START);

  await act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe(START + MINUTE);

  await act(() => vi.advanceTimersByTime(MINUTE + 30 * 1000));
  expect(result.current).toBe(START + 2 * MINUTE);

  await act(() => vi.advanceTimersByTime(30 * 1000));
  expect(result.current).toBe(START + 3 * MINUTE);
});

test("stops when unmounted", async () => {
  const { unmount } = await renderHook(() => useNow());
  expect(vi.getTimerCount()).toBe(1);

  await unmount();

  expect(vi.getTimerCount()).toBe(0);
});

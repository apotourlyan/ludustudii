import { useEffect, useState } from "react";

// How often useNow re-renders its component.
const TICK_MS = 60 * 1000;

// The current time, in milliseconds since the epoch, as Date.now() gives
// it. Re-renders the component every minute while it is mounted, so what
// depends on the time, such as a mark that lasts a few minutes, changes
// even when nothing else re-renders it.
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return now;
}

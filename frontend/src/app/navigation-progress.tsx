import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

// How long a navigation loads before the bar shows, so a fast one doesn't
// flicker it.
const NAVIGATION_PROGRESS_DELAY_MS = 150;

// A thin bar at the top of the viewport while the router loads a
// navigation (ADR 0041). Indeterminate: a segment that slides across, or,
// for users who prefer reduced motion, the whole bar, still. Hidden from
// assistive technology: the pending page announces a long wait.
export function NavigationProgress() {
  const loading = useRouterState({ select: (state) => state.isLoading });
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!loading) {
      return;
    }
    const timer = setTimeout(() => setDelayed(true), NAVIGATION_PROGRESS_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setDelayed(false);
    };
  }, [loading]);

  if (!loading || !delayed) {
    return null;
  }

  return (
    <div
      data-slot="navigation-progress"
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div className="h-full w-2/5 animate-navigation-progress bg-primary motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}

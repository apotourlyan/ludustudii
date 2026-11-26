import { useRef } from "react";

import { notifyError, type CloseToast } from "@/shared/lib/notify";

// The error toast of an action that can be retried, such as a save or a
// delete (ADR 0041). show reports a failure: it closes the toast of the last
// one, if still open, and opens one with the message. clear closes it, as
// when the user tries the action again, so the toast doesn't outlive the
// failure it reports.
export function useErrorToast() {
  const close = useRef<CloseToast | undefined>(undefined);

  function clear() {
    close.current?.();
    close.current = undefined;
  }

  function show(message: string) {
    clear();
    close.current = notifyError(message);
  }

  return { show, clear };
}

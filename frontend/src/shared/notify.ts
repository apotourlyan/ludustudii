import { toast } from "@/shared/ui/toast";

// Reports a failure that isn't about a field, such as a failed delete or a
// save no field can show, as an error toast (ADR 0041). The caller words the
// message (see errorMessage). The toast stays until the user dismisses it,
// and is announced at once. The message is its identity: the same message
// again while its toast is open leaves that one toast, instead of stacking
// a second.
//
// Returns a function that closes the toast. A call site calls it when the
// user tries the action again, so the toast doesn't outlive the failure it
// reports.
export function notifyError(message: string): () => void {
  // An open toast with the message is closed first, so the new one goes to
  // the front. Adding it while it's open would only update it in place,
  // and a toast behind the toaster's limit, which hides the older ones,
  // would stay hidden.
  toast.close(message);
  toast.add({
    id: message,
    type: "error",
    title: message,
    priority: "high",
    timeout: 0,
  });
  return () => toast.close(message);
}

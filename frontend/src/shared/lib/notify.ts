import { toast } from "@/shared/ui/toast";

// The open error toast's ID for each message, so a message has one toast.
const openErrors = new Map<string, string>();

// Reports a failure that isn't about a field, such as a failed delete or a
// save no field can show, as an error toast (ADR 0041). The caller words the
// message (see errorMessage). The toast stays until the user dismisses it,
// and is announced at once.
//
// One toast per message: a message that is already open closes its toast,
// and the new one takes its place in front. Each toast has an ID of its
// own, so the new one is announced again: the toaster announces a toast in
// an alert keyed by its ID, and an alert that stays isn't read again. (With
// the message as the ID, a toast added while its predecessor was still
// leaving reused that alert, and a hidden toast behind the toaster's limit
// was only updated in place, and stayed hidden.)
//
// Closes the toast that notifyError opened.
export type CloseToast = () => void;

// Returns a function that closes this toast. A call site calls it when the
// user tries the action again, so the toast doesn't outlive the failure it
// reports; useErrorToast does this for an action that can be retried.
export function notifyError(message: string): CloseToast {
  const previous = openErrors.get(message);
  if (previous !== undefined) {
    toast.close(previous);
  }
  const id = toast.add({
    type: "error",
    title: message,
    priority: "high",
    timeout: 0,
    // However it closes: dismissed, closed by its call site, or replaced.
    onClose: () => {
      if (openErrors.get(message) === id) {
        openErrors.delete(message);
      }
    },
  });
  openErrors.set(message, id);
  return () => toast.close(id);
}

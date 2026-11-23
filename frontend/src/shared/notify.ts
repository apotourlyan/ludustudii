import { toast } from "@/shared/ui/toast";

// Reports a failure that isn't about a field, such as a failed delete or a
// save no field can show, as an error toast (ADR 0041). The caller words the
// message (see errorMessage). The toast stays until the user dismisses it,
// and is announced at once. The message is its identity: the same message
// again while its toast is open leaves that one toast, instead of stacking
// a second.
export function notifyError(message: string): void {
  toast.add({
    id: message,
    type: "error",
    title: message,
    priority: "high",
    timeout: 0,
  });
}

import { createFormHookContexts } from "@tanstack/react-form";

// The contexts that bind the library's form components to their form and
// field (TanStack Form's composition API, ADR 0042). use-card-form.ts
// builds the form hook on them; a field component reads its field with
// useCardFieldContext.
export const {
  fieldContext: cardFieldContext,
  formContext: cardFormContext,
  useFieldContext: useCardFieldContext,
} = createFormHookContexts();

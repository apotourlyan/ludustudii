import { createFormHookContexts } from "@tanstack/react-form";

// The contexts that bind the library's form components to their form and
// field (TanStack Form's composition API, ADR 0042).
// use-learning-card-app-form.ts builds the form hook on them; a field
// component reads its field with useLearningCardFieldContext.
export const {
  fieldContext: learningCardFieldContext,
  formContext: learningCardFormContext,
  useFieldContext: useLearningCardFieldContext,
} = createFormHookContexts();

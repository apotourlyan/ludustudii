import { createFormHookContexts } from "@tanstack/react-form";

// The contexts that bind the card form's components to their form and
// field (TanStack Form's composition API, ADR 0042): learning-card-form-hook.ts
// builds the card form's setup on them, and a field component reads its
// field with useLearningCardFieldContext.
//
// They are in a file of their own because learning-card-form-hook.ts
// imports the field components: with the contexts there, a field
// component and the setup would import each other.
export const {
  fieldContext: learningCardFieldContext,
  formContext: learningCardFormContext,
  useFieldContext: useLearningCardFieldContext,
} = createFormHookContexts();

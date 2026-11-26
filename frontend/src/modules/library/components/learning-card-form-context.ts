import { createFormHookContexts } from "@tanstack/react-form";

import type { LearningCard } from "@/api/lcards";

import type { LearningCardField } from "../model/learning-card-fields";

// The contexts that bind the card form's components to their form and
// field (TanStack Form's composition API, ADR 0042): learning-card-form-hook.ts
// builds the card form's setup on them, and a field component reads its
// field with useLearningCardFieldContext.
//
// They are in a file of their own because learning-card-form-hook.ts
// imports the field components: with the contexts there, a field
// component and the setup would import each other.
const { fieldContext, formContext, useFieldContext } = createFormHookContexts();

export { fieldContext as learningCardFieldContext, formContext as learningCardFormContext };

// The field of the card form a field component is bound to. TanStack's
// contexts are untyped by design, so the field's value type is stated once
// here, from the card's own type, and field components call this without a
// generic.
export function useLearningCardFieldContext() {
  return useFieldContext<LearningCard[LearningCardField]>();
}

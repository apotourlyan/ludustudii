import { createFormHook } from "@tanstack/react-form";

import { learningCardFieldContext, learningCardFormContext } from "./learning-card-form-context";
import { LearningCardTextField } from "./learning-card-text-field";

// The library's form hook (TanStack Form's composition API, ADR 0042):
// useLearningCardAppForm creates a form whose fields render the library's
// field components
// (`<form.AppField name="title">{(field) => <field.LearningCardTextField />}`),
// and withLearningCardForm makes a component that takes such a form.
export const { useAppForm: useLearningCardAppForm, withForm: withLearningCardForm } =
  createFormHook({
    fieldContext: learningCardFieldContext,
    formContext: learningCardFormContext,
    fieldComponents: { LearningCardTextField },
    formComponents: {},
  });

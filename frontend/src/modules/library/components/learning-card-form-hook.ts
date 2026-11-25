import { createFormHook } from "@tanstack/react-form";

import { learningCardFieldContext, learningCardFormContext } from "./learning-card-form-context";
import { LearningCardTextField } from "./learning-card-text-field";

// The card form's setup (TanStack Form's composition API, ADR 0042), built
// on the contexts in learning-card-form-context.ts:
// useLearningCardFormInstance creates the card form, whose fields render
// the form's field components
// (`<form.AppField name="title">{(field) => <field.LearningCardTextField />}`),
// and withLearningCardFormInstance makes a component that takes it.
//
// The contexts are in a file of their own because this one imports the
// field components, which read their field through the contexts: with the
// contexts here, the two files would import each other.
export const { useAppForm: useLearningCardFormInstance, withForm: withLearningCardFormInstance } =
  createFormHook({
    fieldContext: learningCardFieldContext,
    formContext: learningCardFormContext,
    fieldComponents: { LearningCardTextField },
    formComponents: {},
  });

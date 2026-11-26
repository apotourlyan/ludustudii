import {
  createFormHook,
  type FormAsyncValidateOrFn,
  type FormValidateOrFn,
} from "@tanstack/react-form";

import type { LearningCardField } from "../model/learning-card-fields";
import { learningCardFieldContext, learningCardFormContext } from "./learning-card-form-context";
import { LearningCardTextField } from "./learning-card-text-field";

// The card form's setup (TanStack Form's composition API, ADR 0042), built
// on the contexts in learning-card-form-context.ts:
// useLearningCardFormInstance creates the card form, whose fields render
// the form's field components
// (`<form.AppField name="title">{(field) => <field.LearningCardTextField />}`).
//
// The contexts are in a file of their own because this one imports the
// field components, which read their field through the contexts: with the
// contexts here, the two files would import each other.
export const { useAppForm: useLearningCardFormInstance } = createFormHook({
  fieldContext: learningCardFieldContext,
  formContext: learningCardFormContext,
  fieldComponents: { LearningCardTextField },
  formComponents: {},
});

type LearningCardValues = Record<LearningCardField, string>;
type Check = FormValidateOrFn<LearningCardValues> | undefined;
type AsyncCheck = FormAsyncValidateOrFn<LearningCardValues> | undefined;

// The card form as useLearningCardFormInstance creates it: the card's
// fields as its values. Its form-level validators (it has none: each field
// has its own) and submit meta are what the hook infers when none are
// given.
export type LearningCardFormInstance = ReturnType<
  typeof useLearningCardFormInstance<
    LearningCardValues,
    Check, // onMount
    Check, // onChange
    AsyncCheck, // onChangeAsync
    Check, // onBlur
    AsyncCheck, // onBlurAsync
    Check, // onSubmit
    AsyncCheck, // onSubmitAsync
    Check, // onDynamic
    AsyncCheck, // onDynamicAsync
    AsyncCheck, // onServer
    unknown // submit meta
  >
>;

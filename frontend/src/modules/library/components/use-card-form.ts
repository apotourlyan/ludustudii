import { createFormHook } from "@tanstack/react-form";

import { cardFieldContext, cardFormContext } from "./card-form-context";
import { CardTextField } from "./card-text-field";

// The library's form hook (TanStack Form's composition API, ADR 0042):
// useCardForm creates a form whose fields render the library's field
// components (`<form.AppField name="title">{(field) => <field.CardTextField />}`),
// and withCardForm makes a component that takes such a form.
export const { useAppForm: useCardForm, withForm: withCardForm } = createFormHook({
  fieldContext: cardFieldContext,
  formContext: cardFormContext,
  fieldComponents: { CardTextField },
  formComponents: {},
});

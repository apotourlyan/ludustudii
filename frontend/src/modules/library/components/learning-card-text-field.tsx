import type { ComponentProps, FocusEvent } from "react";

import { Textarea } from "@/shared/ui/textarea";

import { useLearningCardFieldContext } from "./learning-card-form-context";

type LearningCardTextFieldProps = Pick<
  ComponentProps<"textarea">,
  "className" | "placeholder" | "maxLength" | "aria-invalid" | "onFocus" | "onBlur"
>;

// A text field of the card form, bound to its field with form.AppField
// (learning-card-form-hook.ts): a textarea named and identified by the
// field's name, so its label points at it and the form can focus it,
// holding the field's value. Leaving it marks the field blurred, then calls
// onBlur.
export function LearningCardTextField({ onBlur, ...props }: LearningCardTextFieldProps) {
  const field = useLearningCardFieldContext<string>();

  function handleBlur(event: FocusEvent<HTMLTextAreaElement>) {
    field.handleBlur();
    onBlur?.(event);
  }

  return (
    <Textarea
      {...props}
      id={field.name}
      name={field.name}
      value={field.state.value}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={handleBlur}
    />
  );
}

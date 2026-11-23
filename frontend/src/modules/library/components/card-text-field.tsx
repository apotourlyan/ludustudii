import type { ComponentProps, FocusEvent } from "react";

import { Textarea } from "@/shared/ui/textarea";

import { useCardFieldContext } from "./card-form-context";

type CardTextFieldProps = Pick<
  ComponentProps<"textarea">,
  "className" | "placeholder" | "maxLength" | "aria-invalid" | "onFocus" | "onBlur"
>;

// A text field of the card form, bound to its field with form.AppField
// (use-card-form.ts): a textarea named and identified by the field's name,
// so its label points at it and the form can focus it, holding the field's
// value. Leaving it marks the field blurred, then calls onBlur.
export function CardTextField({ onBlur, ...props }: CardTextFieldProps) {
  const field = useCardFieldContext<string>();

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

import { defaultValidationLogic, type ValidationLogicFn } from "@tanstack/react-form";

// TanStack Form drops a field's server error (its `onServer` error) when
// the field changes, which ADR 0038 wants, and also when it loses focus,
// which it doesn't: the server judged the value, and a blur doesn't change
// it. Pass this as the form's `validationLogic` to keep the error through a
// blur.
export const keepServerErrorsOnBlur: ValidationLogicFn = (props) =>
  defaultValidationLogic({
    ...props,
    runValidation: (run) =>
      props.runValidation({
        ...run,
        validators:
          props.event.type === "blur"
            ? run.validators.filter((validator) => validator?.cause !== "server")
            : run.validators,
      }),
  });

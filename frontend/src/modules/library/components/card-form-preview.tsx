import { useStore } from "@tanstack/react-form";

import { LearningCardPreview } from "./learning-card-preview";
import { withCardForm } from "./use-card-form";

// The card form's preview: the card as the form's values would save it,
// read with one subscription to the values, so it follows every keystroke
// in either field. Its parent places it.
export const CardFormPreview = withCardForm({
  defaultValues: { title: "", description: "" },
  props: { className: undefined as string | undefined },
  render: function CardFormPreview({ form, className }) {
    const values = useStore(form.store, (state) => state.values);
    return <LearningCardPreview card={values} className={className} />;
  },
});

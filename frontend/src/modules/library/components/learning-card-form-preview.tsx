import { useSelector } from "@tanstack/react-form";

import { withLearningCardFormInstance } from "./learning-card-form-hook";
import { LearningCardPreview } from "./learning-card-preview";

// The card form's preview: the card as the form's values would save it,
// read with one subscription to the values, so it follows every keystroke
// in either field. Its parent places it.
export const LearningCardFormPreview = withLearningCardFormInstance({
  defaultValues: { title: "", description: "" },
  props: { className: undefined as string | undefined },
  render: function LearningCardFormPreview({ form, className }) {
    const values = useSelector(form.store, (state) => state.values);
    return <LearningCardPreview card={values} className={className} />;
  },
});

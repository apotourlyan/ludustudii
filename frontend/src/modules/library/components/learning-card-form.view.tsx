import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/shared/ui/button";
import { FieldError, FieldLabel } from "@/shared/ui/field";

import { LearningCardFormPreview } from "./learning-card-form-preview";
import type { LearningCardFormState } from "./learning-card-form.state";
import { LearningCardFrame, type LearningCardFrameSection } from "./learning-card-frame";

// From md up, the preview on the left, the editor on the right, and the
// buttons under the editor. Both frames span the seven band rows as
// subgrids, so each row is as tall as the taller of the two sides and the
// bands line up. The rows have no gap: the bands touch, as inside a frame.
// Below md, one column in document order: editor, buttons, preview.
//
// Rows 1-7 are a full frame's bands, in LearningCardFrame's order: strip,
// title label bar, title content, title status bar, description label bar,
// description content (1fr: it takes what is left), description status
// bar. Row 8 holds the buttons.
const GRID =
  "grid grid-cols-1 gap-6 md:grid-cols-2 md:grid-rows-[auto_auto_auto_auto_auto_1fr_auto_auto] md:gap-y-0";
const BAND_ROWS = "md:row-span-7 md:row-start-1 md:grid md:grid-rows-subgrid";
const EDITOR = cn(BAND_ROWS, "md:col-start-2");
const PREVIEW = cn(BAND_ROWS, "md:col-start-1");
const BUTTONS = "flex items-center justify-end gap-2 md:mt-4 md:col-start-2 md:row-start-8";

type FieldState = LearningCardFormState["title"];

// A field as one of the editor's sections: its label and counter in the
// label bar, the field as the content, its errors in the status bar.
function fieldSection(field: FieldState, content: ReactNode): LearningCardFrameSection {
  return {
    label: <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>,
    meta: field.meta,
    progress: field.progress,
    content,
    status: field.invalid ? <FieldError errors={field.errors} /> : null,
    invalid: field.invalid,
    active: field.active,
  };
}

// The card form's markup (ADR 0042): the editor, its buttons, and the
// preview, from what useLearningCardForm returns.
export function LearningCardFormView({
  form,
  formRef,
  onSubmit,
  title,
  description,
  cancelLink,
  submitLabel,
  submitDisabled,
}: LearningCardFormState) {
  return (
    <form ref={formRef} className={GRID} onSubmit={onSubmit}>
      <LearningCardFrame
        className={EDITOR}
        strip="Edit"
        title={fieldSection(
          title,
          <form.AppField name="title" validators={title.validators}>
            {(field) => (
              <field.LearningCardTextField
                className="min-h-5"
                placeholder="Enter title..."
                maxLength={title.maxLength}
                aria-invalid={title.invalid}
                onFocus={title.onFocus}
                onBlur={title.onBlur}
              />
            )}
          </form.AppField>,
        )}
        description={fieldSection(
          description,
          <form.AppField name="description" validators={description.validators}>
            {(field) => (
              // Fills its row, so it ends where the preview's description
              // does when the preview is the taller of the two.
              <field.LearningCardTextField
                className="h-full min-h-50"
                placeholder="Enter description..."
                maxLength={description.maxLength}
                aria-invalid={description.invalid}
                onFocus={description.onFocus}
                onBlur={description.onBlur}
              />
            )}
          </form.AppField>,
        )}
      />

      <div className={BUTTONS}>
        <Link {...cancelLink} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
        <Button type="submit" disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>

      <LearningCardFormPreview form={form} className={PREVIEW} />
    </form>
  );
}

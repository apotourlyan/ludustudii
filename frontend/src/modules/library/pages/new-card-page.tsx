import { LearningCardForm } from "../components/learning-card-form";

// Adds a learning card. The form empties itself after each save, ready for
// the next card.
export function NewCardPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Add Card</h1>
      <LearningCardForm />
    </div>
  );
}

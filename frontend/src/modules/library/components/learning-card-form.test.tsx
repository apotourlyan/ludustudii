// The card form as its pages render it, its state with its view: what a
// user sees when a save fails, against the fake backend (ADR 0043). The
// API's 400s are the test's: the fake only rejects what the form already
// prevents (ADR 0038).

import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import type { LearningCard } from "@/api/lcards";
import { makeCard } from "@/api/lcards/fake/factories";
import { cardStore } from "@/api/lcards/fake/store";
import { notifyError } from "@/shared/lib/notify";
import { fakeBackend } from "@/test/fake-backend";
import { goOffline } from "@/test/online";
import { renderWithProviders } from "@/test/render";

import { LearningCardForm } from "./learning-card-form";
import type { LearningCardFormProps } from "./learning-card-form.state";

const TITLE_REQUIRED = "Title is required";
const DESCRIPTION_REQUIRED = "Description is required";
const DESCRIPTION_TOO_LONG = "Description must be at most 2000 characters";
const SAVE_FAILED = /^Something went wrong while trying to /;
const EDIT_FAILED = "Something went wrong while trying to save your edits.";
const NETWORK = "Can't reach the server. Check your connection and try again.";

// The request ID of every rejection, to find it in the console.
const REQUEST_ID = "7f3c2a10-0000-4000-8000-000000000038";

interface FieldError {
  field: string;
  code: string;
}

const BOTH: FieldError[] = [
  { field: "title", code: "required" },
  { field: "description", code: "max_length" },
];

const title = page.getByLabelText("Title");
const description = page.getByLabelText("Description");

// Toasts aren't the network: the test checks what the form reports, and
// counts the toasts it closes. One toast per message, announced each time,
// is notify.test.tsx's.
const toasts = vi.hoisted(() => ({ closed: 0 }));
vi.mock("@/shared/lib/notify", () => ({
  notifyError: vi.fn(() => () => {
    toasts.closed += 1;
  }),
}));

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(notifyError).mockClear();
  toasts.closed = 0;
});

// The messages the form reported as toasts, in order.
function notified(): string[] {
  return vi.mocked(notifyError).mock.calls.map(([message]) => message);
}

// What the form logged with console.error.
function logged(): string[] {
  return consoleError.mock.calls.map((args: unknown[]) => args.map(String).join(" "));
}

// Answers every create and update with a 400 validation_error listing
// these field errors.
function rejectSaves(errors: FieldError[]): void {
  const reject = () =>
    HttpResponse.json(
      { code: "validation_error", errors },
      { status: 400, headers: { "X-Request-Id": REQUEST_ID } },
    );
  fakeBackend.use(http.post("/api/lcards", reject), http.put("/api/lcards/:id", reject));
}

// Fails the next `times` updates with 500 unexpected_error, and counts
// the failures.
function failUpdates(times = Infinity): { failed: number } {
  const count = { failed: 0 };
  fakeBackend.use(
    http.put("/api/lcards/:id", () => {
      if (count.failed >= times) {
        return undefined;
      }
      count.failed += 1;
      return HttpResponse.json({ code: "unexpected_error" }, { status: 500 });
    }),
  );
  return count;
}

// The form, creating a card or editing the given one.
async function renderForm(card?: LearningCard) {
  const onSaved = vi.fn<LearningCardFormProps["onSaved"]>();
  await renderWithProviders(
    <LearningCardForm card={card} cancelLink={{ to: "/library/cards" }} onSaved={onSaved} />,
    { url: card ? `/library/cards/${card.id}/edit` : "/library/cards/new" },
  );
  return { onSaved };
}

// The form in this mode, with values its own checks accept, ready for the
// API to reject them. Returns its submit button.
async function openForm(mode: "create" | "edit") {
  if (mode === "create") {
    const rendered = await renderForm();
    await title.fill("Photosynthesis");
    await description.fill("Plants make sugar from light.");
    return { ...rendered, submit: page.getByRole("button", { name: "Create card" }) };
  }
  const card = makeCard({ title: "Mitochondria" });
  cardStore.seed([card]);
  const rendered = await renderForm(card);
  await expect.element(title).toHaveValue("Mitochondria");
  await title.fill("Mitochondrion");
  return { ...rendered, submit: page.getByRole("button", { name: "Save card" }) };
}

for (const mode of ["create", "edit"] as const) {
  describe(mode, () => {
    test("the API's errors show on their fields", async () => {
      const { submit } = await openForm(mode);
      rejectSaves(BOTH);

      await submit.click();

      await expect.element(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();
      await expect.element(page.getByText(DESCRIPTION_TOO_LONG, { exact: true })).toBeVisible();
      await expect.element(title).toHaveAttribute("aria-invalid", "true");
      await expect.element(description).toHaveAttribute("aria-invalid", "true");
      // The same look as a client error: the status bars' alerts, and no
      // toast.
      expect(page.getByRole("alert").elements()).toHaveLength(2);
      expect(notified()).toEqual([]);
      expect(page.getByText(SAVE_FAILED).elements()).toHaveLength(0);
      await expect.element(submit).toBeDisabled();
    });

    test("changing the title clears its error, not the description's", async () => {
      const { submit } = await openForm(mode);
      rejectSaves(BOTH);
      await submit.click();
      await expect.element(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();

      // Leaving a field doesn't change it: its error stays.
      await description.click();
      await title.click();
      await description.click();
      await expect.element(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();

      await title.fill("Photosynthesis 2");

      await expect.element(page.getByText(TITLE_REQUIRED, { exact: true })).not.toBeInTheDocument();
      await expect.element(title).toHaveAttribute("aria-invalid", "false");
      await expect.element(page.getByText(DESCRIPTION_TOO_LONG, { exact: true })).toBeVisible();
      await expect.element(description).toHaveAttribute("aria-invalid", "true");
      // The description's error still blocks the submit; the field's own
      // checks still run on change.
      await expect.element(submit).toBeDisabled();
      await title.fill("");
      await expect.element(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();

      await title.fill("Photosynthesis 3");
      await description.fill("Changed.");
      await expect.poll(() => page.getByRole("alert").elements()).toHaveLength(0);
      await expect.element(submit).toBeEnabled();
    });

    test("what the form can't place shows as a toast and in the console", async () => {
      const { submit } = await openForm(mode);
      rejectSaves([
        { field: "tags", code: "required" },
        { field: "title", code: "untrimmed" },
        { field: "description", code: "max_length" },
      ]);

      await submit.click();

      await expect.poll(notified).toEqual([expect.stringMatching(SAVE_FAILED)]);
      // The error the form could place still lands on its field.
      await expect.element(page.getByText(DESCRIPTION_TOO_LONG, { exact: true })).toBeVisible();
      await expect.element(description).toHaveAttribute("aria-invalid", "true");
      // The two it couldn't leave the title alone.
      await expect.element(title).toHaveAttribute("aria-invalid", "false");
      const errors = logged();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(REQUEST_ID);
      // It names what the form couldn't place, not what it could.
      expect(errors[0]).toContain('"tags"');
      expect(errors[0]).toContain('"untrimmed"');
      expect(errors[0]).not.toContain('"description"');
    });
  });
}

test("a validation error without field errors shows as a toast and in the console", async () => {
  const { submit } = await openForm("create");
  rejectSaves([]);

  await submit.click();

  await expect.poll(notified).toEqual([expect.stringMatching(SAVE_FAILED)]);
  await expect.element(title).toHaveAttribute("aria-invalid", "false");
  await expect.element(description).toHaveAttribute("aria-invalid", "false");
  const errors = logged();
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain(REQUEST_ID);
});

describe("focus after a failed submit", () => {
  test("an empty form focuses the title", async () => {
    await renderForm();

    await page.getByRole("button", { name: "Create card" }).click();

    // Both fields are invalid; the first in the form's order gets the focus.
    await expect.element(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();
    await expect.element(page.getByText(DESCRIPTION_REQUIRED, { exact: true })).toBeVisible();
    await expect.element(title).toHaveFocus();
  });

  test("an empty description alone focuses the description", async () => {
    await renderForm();
    await title.fill("Photosynthesis");

    await page.getByRole("button", { name: "Create card" }).click();

    await expect.element(description).toHaveFocus();
  });

  test("an API error on the description alone focuses the description", async () => {
    const { submit } = await openForm("create");
    rejectSaves([{ field: "description", code: "max_length" }]);

    await submit.click();

    await expect.element(page.getByText(DESCRIPTION_TOO_LONG, { exact: true })).toBeVisible();
    await expect.element(description).toHaveFocus();
  });

  test("API errors on both fields focus the title", async () => {
    const { submit } = await openForm("edit");
    rejectSaves(BOTH);

    await submit.click();

    await expect.element(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();
    await expect.element(title).toHaveFocus();
  });
});

// Failures that aren't about a field are toasts (ADR 0041).
describe("a save that fails", () => {
  test("shows one toast, keeps the input and adds nothing to the form", async () => {
    const { submit, onSaved } = await openForm("edit");
    const updates = failUpdates();

    await submit.click();

    await expect.poll(notified).toEqual([EDIT_FAILED]);
    await expect.element(title).toHaveValue("Mitochondrion");
    expect(onSaved).not.toHaveBeenCalled();
    // Nothing next to the buttons: the form itself shows no error.
    expect(page.getByText(EDIT_FAILED).elements()).toHaveLength(0);
    expect(page.getByRole("alert").elements()).toHaveLength(0);

    // The same failure again, while its toast is open: the form closes the
    // toast and reports again, which leaves one toast, announced again.
    // The button reads "Save card" again once the save has settled.
    await submit.click();
    await expect.poll(() => updates.failed).toBe(2);
    await expect.element(submit).toBeEnabled();

    expect(notified()).toEqual([EDIT_FAILED, EDIT_FAILED]);
    expect(toasts.closed).toBe(1);
  });

  test("again, then succeeding, closes its toast and reports nothing", async () => {
    const { submit, onSaved } = await openForm("edit");
    failUpdates(1);
    await submit.click();
    await expect.poll(notified).toEqual([EDIT_FAILED]);

    await submit.click();

    await expect.poll(() => onSaved.mock.calls.length).toBe(1);
    expect(toasts.closed).toBe(1);
    expect(notified()).toEqual([EDIT_FAILED]);
  });

  // TanStack Query pauses requests while the browser is offline unless
  // told otherwise (src/app/query-client.ts); the app sends them anyway, so
  // a save offline fails as any network failure does, at once.
  test("while offline reports the network failure", async () => {
    const { submit } = await openForm("edit");
    fakeBackend.use(http.put("/api/lcards/:id", () => HttpResponse.error()));
    goOffline();

    await submit.click();

    await expect.poll(notified).toEqual([NETWORK]);
  });
});

// The last write wins (ADR 0039): saving replaces a change made elsewhere
// since the form loaded the card, with nothing to resolve.
test("saving a card changed elsewhere replaces the other change", async () => {
  const card = makeCard({ title: "Mitochondria", description: "The cell's powerhouse." });
  cardStore.seed([card]);
  const { onSaved } = await renderForm(card);
  await expect.element(title).toHaveValue("Mitochondria");
  cardStore.replace(card.id, {
    title: "Changed elsewhere",
    description: "Changed in another tab.",
  });

  await title.fill("Mitochondrion");
  await page.getByRole("button", { name: "Save card" }).click();

  await expect.poll(() => onSaved.mock.calls.length).toBe(1);
  expect(cardStore.get(card.id)).toMatchObject({
    title: "Mitochondrion",
    description: "The cell's powerhouse.",
  });
  expect(notified()).toEqual([]);
});

import { useField } from "@tanstack/react-form";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { makeCard } from "@/api/lcards/fake/factories";
import { cardStore } from "@/api/lcards/fake/store";
import { notifyError } from "@/shared/notify";
import { fakeBackend } from "@/test/fake-backend";
import { renderHookWithProviders } from "@/test/render";

import { useLearningCardForm, type LearningCardFormProps } from "./learning-card-form.state";

// Toasts aren't the network: the test checks what the form reports.
vi.mock("@/shared/notify", () => ({ notifyError: vi.fn(() => () => {}) }));

const NETWORK = "Can't reach the server. Check your connection and try again.";

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(notifyError).mockClear();
});

// The hook with its fields mounted as the view mounts them, with their
// validators, so the form validates and holds field errors as in the app.
async function renderForm(props: Partial<LearningCardFormProps> = {}) {
  const onSaved = vi.fn<LearningCardFormProps["onSaved"]>();
  const rendered = await renderHookWithProviders(() => {
    const state = useLearningCardForm({ cancelLink: { to: "/library/cards" }, onSaved, ...props });
    useField({ form: state.form, name: "title", validators: state.title.validators });
    useField({ form: state.form, name: "description", validators: state.description.validators });
    return state;
  });
  return { ...rendered, onSaved };
}

type Rendered = Awaited<ReturnType<typeof renderForm>>;

async function fill({ act, result }: Rendered, title: string, description: string) {
  await act(() => {
    result.current.form.setFieldValue("title", title);
    result.current.form.setFieldValue("description", description);
  });
}

async function submit({ act, result }: Rendered) {
  await act(() => result.current.form.handleSubmit());
}

// Answers every create with the given status and body.
function answerCreate(status: number, body: object) {
  fakeBackend.use(http.post("/api/lcards", () => HttpResponse.json(body, { status })));
}

describe("a save that succeeds", () => {
  test("creates the card, canonicalized, and passes it to onSaved", async () => {
    const form = await renderForm();
    await fill(form, "  Photosynthesis ", "How plants make sugar.\n");

    await submit(form);

    expect(form.onSaved).toHaveBeenCalledExactlyOnceWith({
      id: expect.any(String),
      title: "Photosynthesis",
      description: "How plants make sugar.",
    });
    const [{ id }] = form.onSaved.mock.calls[0]!;
    expect(cardStore.get(id)).toMatchObject({ title: "Photosynthesis" });
    expect(notifyError).not.toHaveBeenCalled();
  });

  test("updates the given card and passes it to onSaved", async () => {
    const card = makeCard({ title: "Old title", description: "Kept." });
    cardStore.seed([card]);
    const form = await renderForm({ card });
    await form.act(() => form.result.current.form.setFieldValue("title", "New title"));

    await submit(form);

    expect(form.onSaved).toHaveBeenCalledExactlyOnceWith({
      id: card.id,
      title: "New title",
      description: "Kept.",
    });
    expect(cardStore.get(card.id)).toMatchObject({ title: "New title", description: "Kept." });
  });
});

describe("a save the API rejects", () => {
  test("shows field errors on their fields, and notifies nothing", async () => {
    answerCreate(400, {
      code: "validation_error",
      errors: [
        { field: "title", code: "max_length" },
        { field: "description", code: "required" },
      ],
    });
    const form = await renderForm();
    await fill(form, "A title", "A description");

    await submit(form);

    expect(form.result.current.title).toMatchObject({
      errors: [{ message: "Title must be at most 200 characters" }],
      invalid: true,
    });
    expect(form.result.current.description).toMatchObject({
      errors: [{ message: "Description is required" }],
      invalid: true,
    });
    expect(notifyError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(form.onSaved).not.toHaveBeenCalled();
  });

  test("notifies and logs once what no field can show", async () => {
    answerCreate(400, { code: "validation_error", errors: [{ field: "tags", code: "required" }] });
    const form = await renderForm();
    await fill(form, "A title", "A description");

    await submit(form);

    expect(notifyError).toHaveBeenCalledExactlyOnceWith(
      "Something went wrong while trying to create the card.",
    );
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("the form can't place"));
    expect(form.result.current.title.invalid).toBe(false);
    expect(form.onSaved).not.toHaveBeenCalled();
  });

  test("clears the last attempt's field errors on the next", async () => {
    answerCreate(400, {
      code: "validation_error",
      errors: [{ field: "title", code: "max_length" }],
    });
    const form = await renderForm();
    await fill(form, "A title", "A description");
    await submit(form);
    expect(form.result.current.title.invalid).toBe(true);

    answerCreate(500, { code: "unexpected_error" });
    await submit(form);

    expect(form.result.current.title.invalid).toBe(false);
  });
});

test("a network failure notifies, without logging", async () => {
  fakeBackend.use(http.post("/api/lcards", () => HttpResponse.error()));
  const form = await renderForm();
  await fill(form, "A title", "A description");

  await submit(form);

  expect(notifyError).toHaveBeenCalledExactlyOnceWith(NETWORK);
  expect(consoleError).not.toHaveBeenCalled();
  expect(form.onSaved).not.toHaveBeenCalled();
});

// Holds every create and update until release() is called, then lets
// the fake answer them.
function holdSaves() {
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  const wait = async () => {
    await held;
  };
  fakeBackend.use(http.post("/api/lcards", wait), http.put("/api/lcards/:id", wait));
  return release;
}

describe("the submit button", () => {
  test.each([
    { mode: "create", card: undefined, label: "Create card", saving: "Creating..." },
    { mode: "update", card: makeCard(), label: "Update card", saving: "Updating..." },
  ])("in $mode mode reads $label, and $saving while saving", async ({ card, label, saving }) => {
    if (card) {
      cardStore.seed([card]);
    }
    const release = holdSaves();
    const form = await renderForm({ card });
    await fill(form, "A title", "A description");
    expect(form.result.current).toMatchObject({ submitLabel: label, submitDisabled: false });

    const submitted = form.act(() => form.result.current.form.handleSubmit());

    await expect
      .poll(() => form.result.current)
      .toMatchObject({ submitLabel: saving, submitDisabled: true });
    release();
    await submitted;
    expect(form.result.current).toMatchObject({ submitLabel: label, submitDisabled: false });
  });

  test("is disabled while a field is invalid", async () => {
    const form = await renderForm();
    await fill(form, "", "A description");

    expect(form.result.current.submitDisabled).toBe(true);
    expect(form.result.current.title).toMatchObject({
      errors: [{ message: "Title is required" }],
      invalid: true,
    });
  });
});

test("a field is active while it has the focus", async () => {
  const form = await renderForm();

  await form.act(() => form.result.current.title.onFocus());
  expect(form.result.current.title.active).toBe(true);
  expect(form.result.current.description.active).toBe(false);

  await form.act(() => form.result.current.title.onBlur());
  expect(form.result.current.title.active).toBe(false);
});

test("previews the card as the form's values would save it", async () => {
  const form = await renderForm();
  expect(form.result.current.preview).toEqual({ title: "", description: "" });

  await fill(form, "Photosynthesis", "How plants make sugar.");

  expect(form.result.current.preview).toEqual({
    title: "Photosynthesis",
    description: "How plants make sugar.",
  });
  expect(form.result.current.title.value).toBe("Photosynthesis");
});

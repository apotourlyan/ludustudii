import { http, HttpResponse } from "msw";
import { afterEach, expect, test, vi } from "vitest";

import { makeCard } from "@/api/lcards/fake/factories";
import { cardStore } from "@/api/lcards/fake/store";
import { notifyError } from "@/shared/notify";
import { fakeBackend } from "@/test/fake-backend";
import { renderHookWithProviders } from "@/test/render";

import { useDeleteLearningCardButton } from "./delete-learning-card-button.state";

// Toasts aren't the network: the test checks what the button reports, and
// counts the toasts it closes.
const toasts = vi.hoisted(() => ({ dismissed: 0 }));
vi.mock("@/shared/notify", () => ({
  notifyError: vi.fn(() => () => {
    toasts.dismissed += 1;
  }),
}));

afterEach(() => {
  vi.mocked(notifyError).mockClear();
  toasts.dismissed = 0;
});

async function renderDelete(card = makeCard()) {
  const onDeleted = vi.fn();
  const rendered = await renderHookWithProviders(() =>
    useDeleteLearningCardButton({ card, onDeleted }),
  );
  // Opens the dialog, as pressing the button does.
  await rendered.act(() => rendered.result.current.onOpenChange(true));
  return { ...rendered, onDeleted };
}

async function confirm({ act, result }: Awaited<ReturnType<typeof renderDelete>>) {
  await act(() => result.current.onConfirm());
  await expect.poll(() => result.current.deleting).toBe(false);
}

test("a delete that succeeds removes the card, closes the dialog and calls onDeleted", async () => {
  const card = makeCard();
  cardStore.seed([card]);
  const button = await renderDelete(card);
  expect(button.result.current.open).toBe(true);

  await confirm(button);

  expect(cardStore.get(card.id)).toBeUndefined();
  expect(button.onDeleted).toHaveBeenCalledOnce();
  expect(button.result.current.open).toBe(false);
  expect(notifyError).not.toHaveBeenCalled();
});

test("a delete that fails closes the dialog and notifies, without onDeleted", async () => {
  const card = makeCard();
  cardStore.seed([card]);
  fakeBackend.use(
    http.delete("/api/lcards/:id", () =>
      HttpResponse.json({ code: "unexpected_error" }, { status: 500 }),
    ),
  );
  const button = await renderDelete(card);

  await confirm(button);

  expect(notifyError).toHaveBeenCalledExactlyOnceWith(
    "Something went wrong while trying to delete the card.",
  );
  expect(button.onDeleted).not.toHaveBeenCalled();
  expect(button.result.current.open).toBe(false);
  expect(cardStore.get(card.id)).toBeDefined();
});

test("a card deleted elsewhere (404) says it doesn't exist", async () => {
  // Never seeded: the fake answers 404.
  const button = await renderDelete(makeCard());

  await confirm(button);

  expect(notifyError).toHaveBeenCalledExactlyOnceWith(
    "This card doesn't exist. It may have been deleted.",
  );
  expect(button.onDeleted).not.toHaveBeenCalled();
});

test("trying again closes the last failure's toast", async () => {
  fakeBackend.use(http.delete("/api/lcards/:id", () => HttpResponse.error()));
  const button = await renderDelete(makeCard());
  await confirm(button);
  expect(toasts.dismissed).toBe(0);

  await button.act(() => button.result.current.onOpenChange(true));
  await confirm(button);

  expect(toasts.dismissed).toBe(1);
  expect(notifyError).toHaveBeenCalledTimes(2);
});

test("while deleting, the dialog stays open and the button says so", async () => {
  const card = makeCard();
  cardStore.seed([card]);
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  fakeBackend.use(
    http.delete("/api/lcards/:id", async () => {
      await held;
    }),
  );
  const button = await renderDelete(card);
  expect(button.result.current).toMatchObject({ deleting: false, confirmLabel: "Delete" });

  await button.act(() => button.result.current.onConfirm());
  await expect
    .poll(() => button.result.current)
    .toMatchObject({ deleting: true, confirmLabel: "Deleting..." });
  await button.act(() => button.result.current.onOpenChange(false));
  expect(button.result.current.open).toBe(true);

  release();
  await expect.poll(() => button.result.current.open).toBe(false);
  expect(button.onDeleted).toHaveBeenCalledOnce();
});

test("the dialog opens and closes while nothing runs", async () => {
  const button = await renderDelete();

  await button.act(() => button.result.current.onOpenChange(false));

  expect(button.result.current.open).toBe(false);
  expect(button.onDeleted).not.toHaveBeenCalled();
});

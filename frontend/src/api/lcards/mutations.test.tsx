// What a delete does to the cached list, against the fake backend (ADR
// 0043): the list a page shows refetches, so it stops showing the card,
// whether this delete removed it or another client already had.

import { useSuspenseQuery } from "@tanstack/react-query";
import { expect, test } from "vitest";

import { renderHookWithProviders } from "@/test/render";

import { ApiError } from "../http";
import { sampleCards } from "./fake/factories";
import { cardStore } from "./fake/store";
import { useDeleteLearningCard } from "./mutations";
import { lcardQueries } from "./queries";

// The sample cards' titles, newest first.
const SAMPLE_TITLES = [
  "Mitochondria",
  "日本語: は vs. が",
  "Python list comprehension",
  "Pythagorean theorem",
  "TCP three-way handshake",
  "Ser vs. estar",
  "Photosynthesis",
  "Binary search",
];

// The list's titles as a page reads them, and the delete, in one client.
async function renderListAndDelete() {
  const rendered = await renderHookWithProviders(() => ({
    titles: useSuspenseQuery(lcardQueries.list()).data.map((card) => card.title),
    deleteCard: useDeleteLearningCard(),
  }));
  await expect.poll(() => rendered.result.current?.titles).toEqual(SAMPLE_TITLES);
  return rendered;
}

type Rendered = Awaited<ReturnType<typeof renderListAndDelete>>;

// Deletes the card, and returns the error it failed with, if any.
async function deleteCard({ act, result }: Rendered, id: string): Promise<unknown> {
  let failure: unknown;
  await act(async () => {
    try {
      await result.current.deleteCard.mutateAsync({ id });
    } catch (error) {
      failure = error;
    }
  });
  return failure;
}

test("the list is the fake's cards, newest first", async () => {
  cardStore.seed(sampleCards());

  const { queryClient } = await renderListAndDelete();

  expect(queryClient.getQueryData(lcardQueries.list().queryKey)).toHaveLength(8);
});

test("a delete refetches the list, without the card", async () => {
  const cards = sampleCards();
  cardStore.seed(cards);
  const rendered = await renderListAndDelete();

  expect(await deleteCard(rendered, cards.at(-1)!.id)).toBeUndefined();

  await expect.poll(() => rendered.result.current.titles).toEqual(SAMPLE_TITLES.slice(1));
});

// A card deleted elsewhere answers a write with 404. The delete fails, so
// its error is shown, and the list refetches, so it stops showing the card.
test("a delete of a card deleted elsewhere fails, and refetches the list without it", async () => {
  const cards = sampleCards();
  cardStore.seed(cards);
  const rendered = await renderListAndDelete();
  cardStore.remove(cards.at(-1)!.id);

  const failure = await deleteCard(rendered, cards.at(-1)!.id);

  expect(failure).toBeInstanceOf(ApiError);
  expect(failure).toMatchObject({ failure: { kind: "http", status: 404 } });
  await expect.poll(() => rendered.result.current.titles).toEqual(SAMPLE_TITLES.slice(1));
});

// The last write wins (ADR 0039): deleting a card changed elsewhere since
// the list loaded it deletes it, with nothing to resolve.
test("a delete of a card changed elsewhere deletes it", async () => {
  const cards = sampleCards();
  cardStore.seed(cards);
  const rendered = await renderListAndDelete();
  cardStore.replace(cards.at(-1)!.id, {
    title: "Changed elsewhere",
    description: "Changed in another tab.",
  });

  expect(await deleteCard(rendered, cards.at(-1)!.id)).toBeUndefined();

  await expect.poll(() => rendered.result.current.titles).toEqual(SAMPLE_TITLES.slice(1));
  expect(cardStore.get(cards.at(-1)!.id)).toBeUndefined();
});

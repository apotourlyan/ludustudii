// The render helpers and the fake backend that the browser tests share:
// queries reach the fake, links work in the router, and nothing carries
// over from one test to the next. The tests run in this order.

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { page } from "vitest/browser";

import { lcardQueries } from "@/api/lcards";
import { makeCards } from "@/api/lcards/fake/factories";
import { cardStore } from "@/api/lcards/fake/store";

import { fakeBackend } from "./fake-backend";
import { renderHookWithProviders, renderWithProviders } from "./render";

// A component that reads the cards query and links to each card.
function CardLinks() {
  const { data: cards } = useSuspenseQuery(lcardQueries.list());
  if (cards.length === 0) {
    return <p>No cards</p>;
  }
  return (
    <ul>
      {cards.map((card) => (
        <li key={card.id}>
          <Link to="/library/cards/$cardId" params={{ cardId: card.id }}>
            {card.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

test("a component reads the fake's cards and links to them in the router", async () => {
  const [first, second] = makeCards(2, (index) => ({ title: `Seeded ${index + 1}` }));
  cardStore.seed([first!, second!]);

  const { queryClient } = await renderWithProviders(<CardLinks />, { url: "/library/cards" });

  // The list is newest first.
  await expect.element(page.getByRole("listitem").first()).toHaveTextContent("Seeded 2");
  await expect
    .element(page.getByRole("link", { name: "Seeded 1" }))
    .toHaveAttribute("href", `/library/cards/${first!.id}`);
  expect(queryClient.getQueryData(lcardQueries.list().queryKey)).toHaveLength(2);
});

test("the next test starts with an empty fake and an empty cache", async () => {
  const { queryClient } = await renderWithProviders(<CardLinks />, { url: "/library/cards" });

  await expect.element(page.getByText("No cards")).toBeVisible();
  expect(queryClient.getQueryData(lcardQueries.list().queryKey)).toEqual([]);
});

test("a hook reads the fake's cards", async () => {
  cardStore.seed(makeCards(3));

  const { result } = await renderHookWithProviders(() => useSuspenseQuery(lcardQueries.list()));

  await expect.poll(() => result.current?.data).toHaveLength(3);
});

test("a test changes what the fake answers", async () => {
  fakeBackend.use(
    http.get("/api/lcards", () =>
      HttpResponse.json({ items: [], next_cursor: null }, { status: 200 }),
    ),
  );
  cardStore.seed(makeCards(1));

  await renderWithProviders(<CardLinks />, { url: "/library/cards" });

  await expect.element(page.getByText("No cards")).toBeVisible();
});

test("the next test gets the fake's own answers again", async () => {
  cardStore.seed(makeCards(1, () => ({ title: "Back to the fake" })));

  await renderWithProviders(<CardLinks />, { url: "/library/cards" });

  await expect.element(page.getByText("Back to the fake")).toBeVisible();
});

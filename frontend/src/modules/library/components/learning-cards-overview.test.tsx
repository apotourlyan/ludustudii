import { expect, test } from "vitest";
import { page } from "vitest/browser";

import { makeCard, makeCards } from "@/api/lcards/fake/factories";
import { renderWithProviders } from "@/test/render";

import type { LearningCardsView } from "../model/learning-cards-view";
import { LearningCardsOverview } from "./learning-cards-overview";

const cards = makeCards(3, (index) => ({ title: `Card ${index + 1}` }));

// The overview in a router, for the cards' links.
function renderOverview(view: LearningCardsView, overviewCards = cards, now = Date.now()) {
  return renderWithProviders(
    <LearningCardsOverview cards={overviewCards} view={view} now={now} initialScrollOffset={0} />,
    { url: "/" },
  );
}

// How tall the first card's item is: a list row is 48px, a grid card 144px.
function firstItemHeight(): number | undefined {
  return page
    .getByRole("list", { name: "Learning cards" })
    .element()
    .querySelector('li[aria-posinset="1"]')
    ?.getBoundingClientRect().height;
}

test("without cards, shows the empty state", async () => {
  await renderOverview("list", []);

  await expect
    .element(page.getByText("No learning cards yet. Add a card to get started."))
    .toBeVisible();
  await expect.element(page.getByRole("list", { name: "Learning cards" })).not.toBeInTheDocument();
});

test("in the list view, shows the cards as a list", async () => {
  await renderOverview("list");

  await expect.element(page.getByText("Card 1", { exact: true })).toBeVisible();
  expect(firstItemHeight()).toBe(48);
  await expect.element(page.getByText("No learning cards yet.")).not.toBeInTheDocument();
});

test("in the grid view, shows the cards as a grid", async () => {
  await renderOverview("grid");

  await expect.element(page.getByText("Card 1", { exact: true })).toBeVisible();
  expect(firstItemHeight()).toBe(144);
  await expect.element(page.getByText("No learning cards yet.")).not.toBeInTheDocument();
});

const items = page.getByRole("list", { name: "Learning cards" }).getByRole("listitem");

// A card's title renders only inline Markdown (learning-card-markdown.tsx),
// so the page's own <h1> stays the only one.
test.each(["list", "grid"] as const)(
  "in the %s view, a title renders inline, without a heading",
  async (view) => {
    await renderOverview(
      view,
      makeCards(1, () => ({ title: "# Photosynthesis **basics**" })),
    );

    const title = page.getByText("Photosynthesis basics", { exact: true });
    await expect.element(title).toBeVisible();
    await expect.element(title.getByRole("strong")).toHaveTextContent("basics");
    expect(page.getByRole("heading").elements()).toHaveLength(0);
  },
);

// Seeded cards are a day old: a fresh session marks none.
test.each(["list", "grid"] as const)("in the %s view, old cards have no mark", async (view) => {
  await renderOverview(view);

  await expect.element(page.getByText("Card 1", { exact: true })).toBeVisible();
  expect(document.querySelectorAll("[data-slot=recent-change-mark]")).toHaveLength(0);
  expect(page.getByText(/^(New|Updated)$/).elements()).toHaveLength(0);
});

// A card created a minute ago, and one created a day ago and updated a
// minute ago.
function recentCards(now: number) {
  const minuteAgo = new Date(now - 60_000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60_000).toISOString();
  return [
    makeCard({ title: "Updated card", created_at: dayAgo, updated_at: minuteAgo }),
    makeCard({ title: "New card", created_at: minuteAgo, updated_at: minuteAgo }),
  ];
}

// The mark's icon in the item that shows this title.
function iconOf(title: string): SVGElement {
  const item = items
    .elements()
    .find((element) => element.querySelector("[data-slot=card-title]")?.textContent === title);
  const icon = item?.querySelector<SVGElement>("svg[data-slot=recent-change-mark]");
  expect(icon, `the mark of "${title}"`).toBeTruthy();
  return icon!;
}

// A computed color as sRGB, read by painting it on a canvas, whatever
// syntax it is in.
function rgb(color: string): number[] {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
}

// WCAG's relative luminance of an sRGB color.
function luminance(color: number[]): number {
  const [red, green, blue] = color.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

// WCAG's contrast ratio between two sRGB colors.
function contrast(a: number[], b: number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

// The icon's color and that of the card behind it.
function iconAndCardColors(icon: SVGElement): { icon: number[]; card: number[] } {
  return {
    icon: rgb(getComputedStyle(icon).color),
    card: rgb(getComputedStyle(icon.closest("[data-slot=card]")!).backgroundColor),
  };
}

test.each(["list", "grid"] as const)(
  "in the %s view, the two marks differ in icon and color, each at least 3:1 against the card",
  async (view) => {
    const now = Date.now();
    await renderOverview(view, recentCards(now), now);
    await expect.element(page.getByText("New card", { exact: true })).toBeVisible();

    const created = iconOf("New card");
    const updated = iconOf("Updated card");
    expect(created.innerHTML, "the icons' drawings").not.toBe(updated.innerHTML);
    const newColors = iconAndCardColors(created);
    const updatedColors = iconAndCardColors(updated);
    expect(newColors.icon, "the icons' colors").not.toEqual(updatedColors.icon);
    expect(contrast(newColors.icon, newColors.card), "new").toBeGreaterThanOrEqual(3);
    expect(contrast(updatedColors.icon, updatedColors.card), "updated").toBeGreaterThanOrEqual(3);
  },
);

test.each(["list", "grid"] as const)(
  "in the %s view, the mark icons aren't framed or interactive",
  async (view) => {
    const now = Date.now();
    await renderOverview(view, recentCards(now), now);
    await expect.element(page.getByText("New card", { exact: true })).toBeVisible();

    for (const title of ["New card", "Updated card"]) {
      const icon = iconOf(title);
      const own = getComputedStyle(icon);
      const parent = getComputedStyle(icon.parentElement!);
      expect(
        {
          cursor: own.cursor,
          border: [own.borderWidth, parent.borderWidth],
          background: [own.backgroundColor, parent.backgroundColor],
          interactive: icon.closest("a, button, [role=button], [tabindex]") !== null,
        },
        title,
      ).toEqual({
        cursor: "auto",
        border: ["0px", "0px"],
        background: ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"],
        interactive: false,
      });
    }
  },
);

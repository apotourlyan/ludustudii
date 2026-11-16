// The learning card list against the fake backend's seeded scenarios.

import { expect, test } from "@playwright/test";

import { currentSlide, goToSlide, nextSlideButton } from "../support/carousel";

// The default scenario's cards, newest first.
const DEFAULT_TITLES = [
  "Mitochondria",
  "日本語: は vs. が",
  "Python list comprehension",
  "Pythagorean theorem",
  "TCP three-way handshake",
  "Ser vs. estar",
  "Photosynthesis",
  "Binary search",
];

test("the default scenario lists its 8 cards, newest first", async ({ page }) => {
  await page.goto("/library/cards");

  await expect(page.getByRole("heading", { name: "Learning Cards", level: 1 })).toBeVisible();
  const slide = currentSlide(page);
  for (const [index, title] of DEFAULT_TITLES.entries()) {
    await expect(slide).toHaveAccessibleName(`${index + 1} of ${DEFAULT_TITLES.length}`);
    await expect(page.getByRole("status")).toHaveText(`${index + 1} / ${DEFAULT_TITLES.length}`);
    await expect(slide.getByText(title, { exact: true })).toBeVisible();
    if (index < DEFAULT_TITLES.length - 1) {
      await nextSlideButton(page).click();
    }
  }
  await expect(nextSlideButton(page)).toBeDisabled();
});

test("cards render their markdown", async ({ page }) => {
  await page.goto("/library/cards");
  const slide = currentSlide(page);

  // "Ser vs. estar": two "##" headings and bold text.
  await goToSlide(page, DEFAULT_TITLES.indexOf("Ser vs. estar") + 1);
  await expect(slide.getByText("Ser vs. estar", { exact: true })).toBeVisible();
  await expect(slide.getByRole("heading", { level: 2 })).toHaveText(["Ser", "Estar"]);
  await expect(slide.getByRole("strong")).toHaveText(["DOCTOR", "PLACE"]);

  // "Binary search": a numbered list, bold text and inline code.
  await goToSlide(page, DEFAULT_TITLES.indexOf("Binary search") + 1);
  await expect(slide.getByText("Binary search", { exact: true })).toBeVisible();
  await expect(slide.getByRole("listitem")).toHaveCount(3);
  await expect(slide.getByRole("strong")).toHaveText("sorted");
  await expect(slide.getByRole("code")).toHaveText(["O(log n)", "O(1)"]);
  await expect(slide.getByText("**sorted**")).toHaveCount(0);
});

test("the empty scenario shows the empty state", async ({ page }) => {
  await page.goto("/library/cards?scenario=empty");

  await expect(
    page.getByText("No learning cards yet. Add a card to get started.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Learning cards" })).toHaveCount(0);
});

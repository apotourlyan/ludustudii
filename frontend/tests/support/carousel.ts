// The learning card list is a carousel, newest first. Only the slide it
// shows is exposed to assistive technology; the others are aria-hidden, so
// role locators skip them, and most aren't rendered at all.

import { expect, type Locator, type Page } from "@playwright/test";

// The carousel's position, such as "3 / 8".
const STATUS_TEXT = /^(\d+) \/ (\d+)$/;

// The slide the carousel shows. Slides are named by position, such as
// "3 of 8".
export function currentSlide(page: Page): Locator {
  return page.getByRole("group", { name: /^\d+ of \d+$/ });
}

// The "Next slide" button below the carousel.
export function nextSlideButton(page: Page): Locator {
  return page.getByRole("button", { name: "Next slide" });
}

// The carousel's position and its number of slides, once it shows them.
async function position(page: Page): Promise<{ current: number; total: number }> {
  const status = page.getByRole("status");
  await expect(status).toHaveText(STATUS_TEXT);
  const [, current, total] = STATUS_TEXT.exec((await status.textContent()) ?? "") ?? [];
  return { current: Number(current), total: Number(total) };
}

// Moves the carousel forward to the slide at this position, counted from 1,
// waiting for each step.
export async function goToSlide(page: Page, target: number): Promise<void> {
  let { current } = await position(page);
  while (current < target) {
    await nextSlideButton(page).click();
    current += 1;
    await expect(page.getByRole("status")).toHaveText(new RegExp(`^${current} / \\d+$`));
  }
}

// Moves the carousel forward, one slide at a time, until it shows the card
// with this exact title, and returns that slide. Fails when no later slide
// has it. For lists that other tests change at the same time, where a
// card's position isn't known, only its title.
export async function showCard(page: Page, title: string): Promise<Locator> {
  let { current, total } = await position(page);
  for (;;) {
    // Waits until the carousel shows this position, so the check below
    // reads its slide and not the one before.
    const slide = page.getByRole("group", { name: `${current} of ${total}`, exact: true });
    await expect(slide).toBeVisible();
    if (await slide.getByText(title, { exact: true }).isVisible()) {
      return slide;
    }
    if (current === total) {
      throw new Error(`no slide shows a card titled ${JSON.stringify(title)}`);
    }
    await nextSlideButton(page).click();
    current += 1;
  }
}

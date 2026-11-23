import { expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { RecentChangeMark } from "./recent-change-mark";

const ICON = "[data-slot=recent-change-mark]";

test.each([
  { change: "new", text: "New" },
  { change: "updated", text: "Updated" },
] as const)("the $change mark reads as $text, its icon hidden", async ({ change, text }) => {
  const screen = await render(<RecentChangeMark change={change} />);

  // Assistive technology reads the hidden text and skips the icon.
  await expect.element(screen.getByText(text, { exact: true })).toBeInTheDocument();
  expect(screen.container.textContent).toBe(text);
  const icon = screen.container.querySelector(ICON);
  expect(icon).toBeInstanceOf(SVGElement);
  expect(icon).toHaveAttribute("aria-hidden", "true");
});

test("new and updated cards get different icons", async () => {
  const screen = await render(
    <>
      <RecentChangeMark change="new" />
      <RecentChangeMark change="updated" />
    </>,
  );

  const [newIcon, updatedIcon] = screen.container.querySelectorAll(ICON);
  expect(newIcon?.innerHTML).toBeTruthy();
  expect(updatedIcon?.innerHTML).toBeTruthy();
  expect(newIcon?.innerHTML).not.toBe(updatedIcon?.innerHTML);
});

test("a card without a recent change gets no mark", async () => {
  const screen = await render(<RecentChangeMark change={undefined} />);

  expect(screen.container).toBeEmptyDOMElement();
});

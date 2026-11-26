import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { CollectionViewSwitchView } from "./collection-view-switch.view";

test("shows the views as a group, the one that is on pressed", async () => {
  await render(<CollectionViewSwitchView value={["grid"]} onValueChange={vi.fn()} />);

  const group = page.getByRole("group", { name: "View" });
  await expect
    .element(group.getByRole("button", { name: "Grid view" }))
    .toHaveAttribute("aria-pressed", "true");
  await expect
    .element(group.getByRole("button", { name: "List view" }))
    .toHaveAttribute("aria-pressed", "false");
});

test("pressing a view reports the group's new values", async () => {
  const onValueChange = vi.fn();
  await render(<CollectionViewSwitchView value={["list"]} onValueChange={onValueChange} />);

  await page.getByRole("button", { name: "Grid view" }).click();

  expect(onValueChange).toHaveBeenCalledOnce();
  expect(onValueChange.mock.calls[0]![0]).toEqual(expect.arrayContaining(["grid"]));
});

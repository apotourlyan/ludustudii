import { expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import type { CardsView } from "../model/cards-view";
import { useCardsViewSwitch } from "./cards-view-switch.state";

async function renderSwitch(view: CardsView) {
  const onChange = vi.fn();
  const { result } = await renderHook(() => useCardsViewSwitch({ view, onChange }));
  return { switch: result.current, onChange };
}

test.each(["list", "grid"] as const)("presses the %s view when it is on", async (view) => {
  const { switch: viewSwitch } = await renderSwitch(view);

  expect(viewSwitch.value).toEqual([view]);
});

test("pressing the other view changes to it", async () => {
  const { switch: viewSwitch, onChange } = await renderSwitch("list");

  viewSwitch.onValueChange(["list", "grid"]);

  expect(onChange).toHaveBeenCalledExactlyOnceWith("grid");
});

test("pressing the view that is on keeps it, without a change", async () => {
  const { switch: viewSwitch, onChange } = await renderSwitch("grid");

  viewSwitch.onValueChange([]);

  expect(onChange).not.toHaveBeenCalled();
});

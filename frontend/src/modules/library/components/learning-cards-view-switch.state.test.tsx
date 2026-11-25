import { expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import type { LearningCardsView } from "../model/learning-cards-view";
import { useLearningCardsViewSwitch } from "./learning-cards-view-switch.state";

async function renderSwitch(view: LearningCardsView) {
  const onChange = vi.fn();
  const { result } = await renderHook(() => useLearningCardsViewSwitch({ view, onChange }));
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

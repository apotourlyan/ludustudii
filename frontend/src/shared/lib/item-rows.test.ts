import { describe, expect, test } from "vitest";

import { itemSlots, rowCount, rowOfItem, withRow } from "./item-rows";

const items = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

test.each([
  { count: 0, columns: 1, rows: 0 },
  { count: 1, columns: 4, rows: 1 },
  { count: 4, columns: 4, rows: 1 },
  { count: 5, columns: 4, rows: 2 },
  { count: 150, columns: 3, rows: 50 },
])("$count items in rows of $columns take $rows rows", ({ count, columns, rows }) => {
  expect(rowCount(count, columns)).toBe(rows);
});

describe("rowOfItem", () => {
  test.each([
    { id: "a", columns: 1, row: 0 },
    { id: "e", columns: 1, row: 4 },
    { id: "b", columns: 2, row: 0 },
    { id: "c", columns: 2, row: 1 },
    { id: "e", columns: 4, row: 1 },
  ])("finds item $id in row $row of rows of $columns", ({ id, columns, row }) => {
    expect(rowOfItem(items, id, columns)).toBe(row);
  });

  test("is null without an ID or for an item that isn't there", () => {
    expect(rowOfItem(items, null, 2)).toBeNull();
    expect(rowOfItem(items, "z", 2)).toBeNull();
  });
});

describe("withRow", () => {
  test("adds the kept row in order", () => {
    expect(withRow([3, 4, 5], 40)).toEqual([3, 4, 5, 40]);
    expect(withRow([30, 31], 2)).toEqual([2, 30, 31]);
  });

  test("leaves the rows as they are when it is among them, or there is none", () => {
    expect(withRow([3, 4, 5], 4)).toEqual([3, 4, 5]);
    expect(withRow([3, 4, 5], null)).toEqual([3, 4, 5]);
  });
});

describe("itemSlots", () => {
  test("places each rendered row's items side by side, with their positions", () => {
    const slots = itemSlots(
      [
        { index: 0, size: 100, start: 300 },
        { index: 2, size: 100, start: 532 },
      ],
      items,
      { columns: 2, gap: 16, scrollMargin: 300 },
    );

    expect(slots).toEqual([
      {
        item: { id: "a" },
        position: 1,
        style: {
          height: 100,
          width: "calc((100% - 16px) / 2)",
          left: "calc(0 * (((100% - 16px) / 2) + 16px))",
          transform: "translateY(0px)",
        },
      },
      {
        item: { id: "b" },
        position: 2,
        style: {
          height: 100,
          width: "calc((100% - 16px) / 2)",
          left: "calc(1 * (((100% - 16px) / 2) + 16px))",
          transform: "translateY(0px)",
        },
      },
      // The last row holds what is left.
      {
        item: { id: "e" },
        position: 5,
        style: {
          height: 100,
          width: "calc((100% - 16px) / 2)",
          left: "calc(0 * (((100% - 16px) / 2) + 16px))",
          transform: "translateY(232px)",
        },
      },
    ]);
  });

  test("gives a single column the full width", () => {
    const [slot] = itemSlots([{ index: 1, size: 50, start: 66 }], items, {
      columns: 1,
      gap: 8,
      scrollMargin: 0,
    });

    expect(slot).toEqual({
      item: { id: "b" },
      position: 2,
      style: {
        height: 50,
        width: "calc((100% - 0px) / 1)",
        left: "calc(0 * (((100% - 0px) / 1) + 8px))",
        transform: "translateY(66px)",
      },
    });
  });
});

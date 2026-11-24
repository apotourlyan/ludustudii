import { describe, expect, test } from "vitest";

import {
  CARD_LIMITS,
  canonicalize,
  canonicalLength,
  isBlank,
  validateDescription,
  validateTitle,
} from "./learning-card-fields";

// "é" as "e" and a combining acute accent: two code points, one after NFC.
const DECOMPOSED_E = "é";
// One code point, two UTF-16 code units.
const EMOJI = "\u{1F600}";

describe("canonicalize", () => {
  test("trims whitespace at both ends and keeps it inside", () => {
    expect(canonicalize(" \t\n a  b \r\n")).toBe("a  b");
  });

  test("normalizes to NFC", () => {
    expect(canonicalize(`caf${DECOMPOSED_E}`)).toBe("café");
  });

  // Where JS trim() and the server's strings.TrimSpace differ: the form
  // strips U+FEFF and keeps U+0085.
  test("strips a byte order mark and keeps U+0085", () => {
    expect(canonicalize("﻿a﻿")).toBe("a");
    expect(canonicalize("\u0085a\u0085")).toBe("\u0085a\u0085");
  });
});

describe("isBlank", () => {
  test("is true for empty text and whitespace only, which canonicalizing empties", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank(" \t\n\r\n ")).toBe(true);
    expect(isBlank("﻿")).toBe(true);
  });

  test("is false for any text that canonicalizing keeps", () => {
    expect(isBlank(" a ")).toBe(false);
    expect(isBlank("\u0085")).toBe(false);
  });
});

describe("canonicalLength", () => {
  test("counts code points, not UTF-16 code units", () => {
    expect(canonicalLength(EMOJI.repeat(3))).toBe(3);
  });

  test("counts after canonicalizing", () => {
    expect(canonicalLength(`  ${DECOMPOSED_E.repeat(3)}  `)).toBe(3);
  });
});

describe.each([
  { field: "title", validate: validateTitle, limit: CARD_LIMITS.title },
  { field: "description", validate: validateDescription, limit: CARD_LIMITS.description },
] as const)("the $field check", ({ validate, limit }) => {
  const check = (value: string) => validate({ value });

  test.each(["", " ", " \t\n ", "﻿"])("requires a value: %j", (value) => {
    expect(check(value)).toBe("required");
  });

  test("accepts one character", () => {
    expect(check("a")).toBeUndefined();
  });

  test("accepts the limit and rejects one more", () => {
    expect(check("a".repeat(limit))).toBeUndefined();
    expect(check("a".repeat(limit + 1))).toBe("max_length");
  });

  test("leaves surrounding whitespace out of the length", () => {
    expect(check(` ${"a".repeat(limit)}\n`)).toBeUndefined();
  });

  test("counts code points: the limit in characters of two code units passes", () => {
    expect(check(EMOJI.repeat(limit))).toBeUndefined();
    expect(check(EMOJI.repeat(limit + 1))).toBe("max_length");
  });

  test("counts after NFC: twice the limit in code points that compose to the limit passes", () => {
    expect(check(DECOMPOSED_E.repeat(limit))).toBeUndefined();
    expect(check(DECOMPOSED_E.repeat(limit + 1))).toBe("max_length");
  });
});

test("the limits are the API's", () => {
  expect(CARD_LIMITS).toEqual({ title: 200, description: 2000 });
});

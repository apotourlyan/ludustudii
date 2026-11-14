// Valid learning cards for seeding the fake lcards store and for tests.
// IDs come from the shared monotonic generator, so cards built later sort
// as newer, and cards created through the store sort after all of them.

import { uuidv7 } from "../../fake/uuidv7";
import type { LearningCard } from "./store";

let sequence = 0;

// A valid card at version 1 with a unique title, overridden field by field.
export function makeCard(overrides: Partial<LearningCard> = {}): LearningCard {
  sequence += 1;
  return {
    id: uuidv7(),
    version: 1,
    title: `Card ${sequence}`,
    description: `The description of card ${sequence}.`,
    ...overrides,
  };
}

// `count` cards, oldest first. `overrides` receives each card's position,
// starting at 0.
export function makeCards(
  count: number,
  overrides: (index: number) => Partial<LearningCard> = () => ({}),
): LearningCard[] {
  return Array.from({ length: count }, (_, index) => makeCard(overrides(index)));
}

// A small library of realistic cards, oldest first: markdown of different
// kinds and lengths, non-ASCII text, and one card edited twice.
export function sampleCards(): LearningCard[] {
  return SAMPLES.map((sample) => makeCard(sample));
}

const SAMPLES: Partial<LearningCard>[] = [
  {
    title: "Binary search",
    description: [
      "Find a value in a **sorted** array by halving the search range each step.",
      "",
      "1. Compare the target with the middle element.",
      "2. If it is smaller, continue in the left half; if larger, in the right half.",
      "3. Stop when the element is found or the range is empty.",
      "",
      "Runs in `O(log n)` time and `O(1)` extra space.",
    ].join("\n"),
  },
  {
    title: "Photosynthesis",
    description: [
      "Plants turn light, water and carbon dioxide into glucose and oxygen:",
      "",
      "> 6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂",
      "",
      "The **light-dependent reactions** happen in the thylakoid membranes; the",
      "**Calvin cycle** happens in the stroma.",
    ].join("\n"),
  },
  {
    title: "Ser vs. estar",
    description: [
      "## Ser",
      "Permanent traits, identity, origin, time: *Soy de México. Son las tres.*",
      "",
      "## Estar",
      "States, location, results of change: *Estoy cansado. La tienda está cerrada.*",
      "",
      "Mnemonic: **DOCTOR** for *ser*, **PLACE** for *estar*.",
    ].join("\n"),
  },
  {
    title: "TCP three-way handshake",
    description: [
      "How a TCP connection is opened:",
      "",
      "- Client → server: `SYN` with an initial sequence number *x*",
      "- Server → client: `SYN-ACK` with its own number *y* and ack *x + 1*",
      "- Client → server: `ACK` with ack *y + 1*",
      "",
      "See [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293) for the details.",
    ].join("\n"),
  },
  {
    title: "Pythagorean theorem",
    version: 3,
    description:
      "In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides: *a² + b² = c²*.",
  },
  {
    title: "Python list comprehension",
    description: [
      "Build a list from an iterable in one expression:",
      "",
      "```python",
      "squares = [n * n for n in range(10) if n % 2 == 0]",
      "# [0, 4, 16, 36, 64]",
      "```",
      "",
      "Use a generator expression `(…)` instead when the list is only iterated once.",
    ].join("\n"),
  },
  {
    title: "日本語: は vs. が",
    description: [
      "**は** marks the topic: what the sentence is about.",
      "**が** marks the subject, often new or emphasized information.",
      "",
      "- 私は学生です。 — *As for me, I am a student.*",
      "- 誰が来ましたか。 — *Who came?*",
    ].join("\n"),
  },
  {
    title: "Mitochondria",
    description: "The site of aerobic respiration; produces most of the cell’s ATP.",
  },
];

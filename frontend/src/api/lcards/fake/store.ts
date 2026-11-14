// The fake lcards service's state and its rules, without HTTP (ADR 0032).
// It mirrors the backend's stores: IDs are UUIDv7, so ordering by ID is
// creation order; versions start at 1 and every replace increments them;
// replace and remove check the expected version and report an unknown card
// before a stale version. Handlers map the outcomes to HTTP.

import { uuidv7 } from "../../fake/uuidv7";
import type { components } from "../../schema.gen";

export type LearningCard = components["schemas"]["LearningCard"];
export type CardContent = Pick<LearningCard, "title" | "description">;

export interface CardPage {
  // Newest first.
  items: LearningCard[];
  // The token for the next page, or null on the last page.
  nextCursor: string | null;
}

export type ReplaceResult =
  | { outcome: "replaced"; version: number }
  | { outcome: "not_found" }
  | { outcome: "stale" };

export type RemoveResult = { outcome: "removed" } | { outcome: "not_found" } | { outcome: "stale" };

export class CardStore {
  readonly #cards = new Map<string, LearningCard>();
  // Every cursor this store handed out, with the ID of the last card on the
  // page it ended. A cursor stays valid after that card is removed, as the
  // backend's does, and anything not in here is rejected.
  readonly #cursors = new Map<string, string>();

  // Removes every card and forgets every cursor.
  reset(): void {
    this.#cards.clear();
    this.#cursors.clear();
  }

  // Adds the cards as they are, replacing any with the same ID. Build them
  // with the factories so their IDs keep sorting in creation order.
  seed(cards: Iterable<LearningCard>): void {
    for (const card of cards) {
      this.#cards.set(card.id, { ...card });
    }
  }

  // Up to `limit` cards (at least 1) with IDs smaller than the cursor's,
  // newest first. The cursor must be one this store handed out (see
  // isCursor) or undefined for the first page.
  list({ limit, cursor }: { limit: number; cursor?: string }): CardPage {
    let after: string | undefined;
    if (cursor !== undefined) {
      after = this.#cursors.get(cursor);
      if (after === undefined) {
        throw new Error(`fake lcards store: unknown cursor ${JSON.stringify(cursor)}`);
      }
    }

    const sorted = [...this.#cards.values()]
      .filter((card) => after === undefined || card.id < after)
      .toSorted((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

    const items = sorted.slice(0, limit).map((card) => ({ ...card }));
    const last = items.at(-1);
    const nextCursor = sorted.length > limit && last ? this.#issueCursor(last.id) : null;
    return { items, nextCursor };
  }

  // Whether the cursor is one this store handed out.
  isCursor(cursor: string): boolean {
    return this.#cursors.has(cursor);
  }

  get(id: string): LearningCard | undefined {
    const card = this.#cards.get(id);
    return card && { ...card };
  }

  create(content: CardContent): LearningCard {
    const card: LearningCard = { id: uuidv7(), version: 1, ...content };
    this.#cards.set(card.id, card);
    return { ...card };
  }

  replace(id: string, expectedVersion: number, content: CardContent): ReplaceResult {
    const card = this.#cards.get(id);
    if (!card) {
      return { outcome: "not_found" };
    }
    if (card.version !== expectedVersion) {
      return { outcome: "stale" };
    }
    const version = card.version + 1;
    this.#cards.set(id, { ...card, ...content, version });
    return { outcome: "replaced", version };
  }

  remove(id: string, expectedVersion: number): RemoveResult {
    const card = this.#cards.get(id);
    if (!card) {
      return { outcome: "not_found" };
    }
    if (card.version !== expectedVersion) {
      return { outcome: "stale" };
    }
    this.#cards.delete(id);
    return { outcome: "removed" };
  }

  // The same page boundary always gets the same token: unpadded base64url,
  // so it needs no escaping in a query string. The encoding is deliberately
  // not the backend's bare UUID, so a client that parses or builds cursors
  // breaks against the fake too (ADR 0022).
  #issueCursor(lastId: string): string {
    const token = btoa(`lcards:after:${lastId}`)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    this.#cursors.set(token, lastId);
    return token;
  }
}

// The store the fake's handlers use. Other fakes may call it to simulate
// backend events; tests reset it between tests.
export const cardStore = new CardStore();

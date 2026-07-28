import type { BriefingItemState, LibraryItemPage } from "@tempo/contracts";
import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  applyOptimisticItemState,
  reconcileItemState,
  removeCachedLibraryItem,
} from "../src/features/library/state-cache";

const itemId = "00000000-0000-4000-8000-000000000101";
const now = "2026-07-27T20:00:00.000Z";

const state = (overrides = {}): BriefingItemState => ({
  id: "00000000-0000-4000-8000-000000000102",
  briefingItemId: itemId,
  savedAt: now,
  deferredAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("library item state cache", () => {
  it("optimistically preserves independent Saved and Later state", () => {
    const saved = applyOptimisticItemState([], itemId, { saved: true }, now);
    const deferred = applyOptimisticItemState(
      saved,
      itemId,
      { deferred: true },
      now,
    );
    const laterOnly = applyOptimisticItemState(
      deferred,
      itemId,
      { saved: false },
      now,
    );

    expect(deferred).toMatchObject([
      { briefingItemId: itemId, savedAt: now, deferredAt: now },
    ]);
    expect(laterOnly).toMatchObject([
      { briefingItemId: itemId, savedAt: null, deferredAt: now },
    ]);
  });

  it("removes an item only after its final active state is cleared", () => {
    const both = [state({ deferredAt: now })];

    expect(
      applyOptimisticItemState(both, itemId, { saved: false }, now),
    ).toHaveLength(1);
    expect(
      applyOptimisticItemState(
        both,
        itemId,
        {
          saved: false,
          deferred: false,
        },
        now,
      ),
    ).toEqual([]);
  });

  it("reconciles the optimistic placeholder with the server state", () => {
    const optimistic = applyOptimisticItemState(
      [],
      itemId,
      { saved: true },
      now,
    );
    const stored = state();

    expect(reconcileItemState(optimistic, itemId, stored)).toEqual([stored]);
    expect(reconcileItemState([stored], itemId, null)).toEqual([]);
  });

  it("removes the matching item from every cached collection page", () => {
    const otherItemId = "00000000-0000-4000-8000-000000000103";
    const page = {
      items: [{ item: { id: itemId } }, { item: { id: otherItemId } }],
      nextCursor: null,
    } as unknown as LibraryItemPage;
    const cache: InfiniteData<LibraryItemPage, string | undefined> = {
      pages: [page],
      pageParams: [undefined],
    };

    expect(removeCachedLibraryItem(cache, itemId)?.pages[0]?.items).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({ id: otherItemId }),
      }),
    ]);
  });
});

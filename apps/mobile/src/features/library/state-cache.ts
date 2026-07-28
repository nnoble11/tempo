import type {
  BriefingItemState,
  LibraryItemPage,
  UpdateBriefingItemState,
} from "@tempo/contracts";
import type { InfiniteData } from "@tanstack/react-query";

export const applyOptimisticItemState = (
  current: BriefingItemState[] | undefined,
  briefingItemId: string,
  input: UpdateBriefingItemState,
  now: string,
): BriefingItemState[] | undefined => {
  if (current === undefined) return undefined;
  const existing = current.find(
    (state) => state.briefingItemId === briefingItemId,
  );
  const savedAt =
    input.saved === undefined
      ? (existing?.savedAt ?? null)
      : input.saved
        ? now
        : null;
  const deferredAt =
    input.deferred === undefined
      ? (existing?.deferredAt ?? null)
      : input.deferred
        ? now
        : null;
  const withoutItem = current.filter(
    (state) => state.briefingItemId !== briefingItemId,
  );

  if (savedAt === null && deferredAt === null) return withoutItem;

  return [
    ...withoutItem,
    existing === undefined
      ? {
          id: briefingItemId,
          briefingItemId,
          savedAt,
          deferredAt,
          createdAt: now,
          updatedAt: now,
        }
      : {
          ...existing,
          savedAt,
          deferredAt,
          updatedAt: now,
        },
  ];
};

export const reconcileItemState = (
  current: BriefingItemState[] | undefined,
  briefingItemId: string,
  state: BriefingItemState | null,
): BriefingItemState[] | undefined => {
  if (current === undefined) return undefined;
  const withoutItem = current.filter(
    (itemState) => itemState.briefingItemId !== briefingItemId,
  );
  return state === null ? withoutItem : [...withoutItem, state];
};

export const removeCachedLibraryItem = (
  current: InfiniteData<LibraryItemPage, string | undefined> | undefined,
  briefingItemId: string,
): InfiniteData<LibraryItemPage, string | undefined> | undefined =>
  current === undefined
    ? undefined
    : {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.filter(({ item }) => item.id !== briefingItemId),
        })),
      };

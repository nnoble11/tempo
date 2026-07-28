import type {
  BriefingItemState,
  LibraryItemPage,
  UpdateBriefingItemState,
} from "@tempo/contracts";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  fetchBriefingHistory,
  fetchBriefingItemStates,
  fetchLibraryItems,
  updateBriefingItemState,
} from "./api";
import {
  applyOptimisticItemState,
  reconcileItemState,
  removeCachedLibraryItem,
} from "./state-cache";

export const useBriefingHistory = () =>
  useInfiniteQuery({
    queryKey: ["briefings", "history"],
    queryFn: ({ pageParam }) => fetchBriefingHistory(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useLibraryItems = (kind: "saved" | "later") =>
  useInfiniteQuery({
    queryKey: ["library", kind],
    queryFn: ({ pageParam }) => fetchLibraryItems(kind, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useBriefingItemStates = (briefingId: string | undefined) =>
  useQuery({
    queryKey: ["briefing-item-states", briefingId],
    queryFn: () => fetchBriefingItemStates(briefingId ?? ""),
    enabled: briefingId !== undefined,
  });

export const useUpdateBriefingItemState = () => {
  const client = useQueryClient();
  return useMutation({
    scope: { id: "briefing-item-state" },
    mutationFn: ({
      briefingItemId,
      input,
    }: {
      briefingItemId: string;
      input: UpdateBriefingItemState;
    }) => updateBriefingItemState(briefingItemId, input),
    onMutate: async ({ briefingItemId, input }) => {
      await Promise.all([
        client.cancelQueries({ queryKey: ["briefing-item-states"] }),
        client.cancelQueries({ queryKey: ["library"] }),
      ]);
      const stateSnapshots = client.getQueriesData<BriefingItemState[]>({
        queryKey: ["briefing-item-states"],
      });
      const librarySnapshots = client.getQueriesData<
        InfiniteData<LibraryItemPage, string | undefined>
      >({ queryKey: ["library"] });
      const now = new Date().toISOString();

      client.setQueriesData<BriefingItemState[]>(
        { queryKey: ["briefing-item-states"] },
        (current) =>
          applyOptimisticItemState(current, briefingItemId, input, now),
      );
      if (input.saved === false) {
        client.setQueriesData<
          InfiniteData<LibraryItemPage, string | undefined>
        >({ queryKey: ["library", "saved"] }, (current) =>
          removeCachedLibraryItem(current, briefingItemId),
        );
      }
      if (input.deferred === false) {
        client.setQueriesData<
          InfiniteData<LibraryItemPage, string | undefined>
        >({ queryKey: ["library", "later"] }, (current) =>
          removeCachedLibraryItem(current, briefingItemId),
        );
      }
      return { librarySnapshots, stateSnapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [queryKey, data] of context?.stateSnapshots ?? []) {
        client.setQueryData(queryKey, data);
      }
      for (const [queryKey, data] of context?.librarySnapshots ?? []) {
        client.setQueryData(queryKey, data);
      }
    },
    onSuccess: (state, { briefingItemId }) => {
      client.setQueriesData<BriefingItemState[]>(
        { queryKey: ["briefing-item-states"] },
        (current) => reconcileItemState(current, briefingItemId, state),
      );
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["briefing-item-states"] }),
        client.invalidateQueries({ queryKey: ["library"] }),
      ]),
  });
};

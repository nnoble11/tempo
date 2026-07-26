import type { UpdateBriefingItemState } from "@tempo/contracts";
import {
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
    mutationFn: ({
      briefingItemId,
      input,
    }: {
      briefingItemId: string;
      input: UpdateBriefingItemState;
    }) => updateBriefingItemState(briefingItemId, input),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["briefing-item-states"] }),
        client.invalidateQueries({ queryKey: ["library"] }),
      ]),
  });
};

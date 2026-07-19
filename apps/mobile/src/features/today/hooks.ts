import type { CreateBriefingInteraction } from "@tempo/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createBriefingInteraction,
  fetchBriefing,
  fetchTodayBriefing,
} from "./api";

export const todayBriefingQueryKey = ["briefings", "today"] as const;

export const useTodayBriefing = () =>
  useQuery({
    queryKey: todayBriefingQueryKey,
    queryFn: fetchTodayBriefing,
    staleTime: 60_000,
  });

export const useBriefing = (briefingId: string) =>
  useQuery({
    queryKey: ["briefings", briefingId],
    queryFn: () => fetchBriefing(briefingId),
    enabled: briefingId.length > 0,
    staleTime: 5 * 60_000,
  });

export type RecordInteractionVariables = {
  briefingId: string;
  briefingItemId: string;
  interaction: CreateBriefingInteraction;
};

export const useRecordBriefingInteraction = () =>
  useMutation({
    mutationFn: ({
      briefingId,
      briefingItemId,
      interaction,
    }: RecordInteractionVariables) =>
      createBriefingInteraction(briefingId, briefingItemId, interaction),
  });

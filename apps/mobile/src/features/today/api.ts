import {
  BriefingInteractionSchema,
  CanonicalBriefingSchema,
  TodayBriefingResponseSchema,
  type BriefingInteraction,
  type CanonicalBriefing,
  type CreateBriefingInteraction,
  type TodayBriefingResponse,
} from "@tempo/contracts";

import { authenticatedRequest } from "../../api/client";

export const fetchTodayBriefing = async (): Promise<TodayBriefingResponse> => {
  const response = await authenticatedRequest("/v1/briefings/today");
  return TodayBriefingResponseSchema.parse(await response.json());
};

export const fetchBriefing = async (
  briefingId: string,
): Promise<CanonicalBriefing> => {
  const response = await authenticatedRequest(`/v1/briefings/${briefingId}`);
  return CanonicalBriefingSchema.parse(await response.json());
};

export const createBriefingInteraction = async (
  briefingId: string,
  briefingItemId: string,
  interaction: CreateBriefingInteraction,
): Promise<BriefingInteraction> => {
  const response = await authenticatedRequest(
    `/v1/briefings/${briefingId}/items/${briefingItemId}/interactions`,
    {
      method: "POST",
      body: JSON.stringify(interaction),
    },
  );
  return BriefingInteractionSchema.parse(await response.json());
};

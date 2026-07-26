import {
  BriefingHistoryPageSchema,
  BriefingItemStateListSchema,
  BriefingItemStateSchema,
  LibraryItemPageSchema,
  type BriefingHistoryPage,
  type BriefingItemState,
  type LibraryItemPage,
  type UpdateBriefingItemState,
} from "@tempo/contracts";

import { authenticatedRequest } from "../../api/client";

export const fetchBriefingHistory = async (
  cursor?: string,
): Promise<BriefingHistoryPage> => {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor !== undefined) query.set("cursor", cursor);
  const response = await authenticatedRequest(`/v1/briefings?${query}`);
  return BriefingHistoryPageSchema.parse(await response.json());
};

export const fetchLibraryItems = async (
  kind: "saved" | "later",
  cursor?: string,
): Promise<LibraryItemPage> => {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor !== undefined) query.set("cursor", cursor);
  const response = await authenticatedRequest(`/v1/library/${kind}?${query}`);
  return LibraryItemPageSchema.parse(await response.json());
};

export const fetchBriefingItemStates = async (
  briefingId: string,
): Promise<BriefingItemState[]> => {
  const response = await authenticatedRequest(
    `/v1/briefings/${briefingId}/item-states`,
  );
  return BriefingItemStateListSchema.parse(await response.json()).items;
};

export const updateBriefingItemState = async (
  briefingItemId: string,
  input: UpdateBriefingItemState,
): Promise<BriefingItemState | null> => {
  const response = await authenticatedRequest(
    `/v1/briefing-items/${briefingItemId}/state`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  return response.status === 204
    ? null
    : BriefingItemStateSchema.parse(await response.json());
};

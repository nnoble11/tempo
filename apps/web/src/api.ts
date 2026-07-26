"use client";

import {
  CanonicalBriefingSchema,
  BriefingHistoryPageSchema,
  BriefingItemStateListSchema,
  BriefingItemStateSchema,
  CalendarAvailabilitySchema,
  CompleteOnboardingResultSchema,
  DeliveryEndpointSchema,
  InterestPageSchema,
  LibraryItemPageSchema,
  TodayBriefingResponseSchema,
  UserInterestSchema,
  UserProfileSchema,
  type BriefingHistoryPage,
  type BriefingItemState,
  type CalendarAvailability,
  type CanonicalBriefing,
  type CompleteOnboardingInput,
  type CompleteOnboardingResult,
  type CreateBriefingInteraction,
  type CreateInterest,
  type DeliveryEndpoint,
  type InterestPage,
  type LibraryItemPage,
  type TodayBriefingResponse,
  type UpdateBriefingItemState,
  type UpdateUserInterest,
  type UserInterest,
  type UserProfile,
} from "@tempo/contracts";

import { getWebAccessToken } from "./supabase";

const request = async (path: string, init?: RequestInit): Promise<Response> => {
  const origin = process.env.NEXT_PUBLIC_API_URL;
  if (origin === undefined) {
    throw new Error("Tempo web API is not configured.");
  }
  const token = await getWebAccessToken();
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(new URL(path, origin), { ...init, headers });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }
  return response;
};

export const fetchProfile = async (): Promise<UserProfile> =>
  UserProfileSchema.parse(await (await request("/v1/users/me")).json());

export const fetchToday = async (): Promise<TodayBriefingResponse> =>
  TodayBriefingResponseSchema.parse(
    await (await request("/v1/briefings/today")).json(),
  );

export const fetchBriefing = async (
  briefingId: string,
): Promise<CanonicalBriefing> =>
  CanonicalBriefingSchema.parse(
    await (await request(`/v1/briefings/${briefingId}`)).json(),
  );

export const fetchBriefingHistory = async (
  cursor?: string,
): Promise<BriefingHistoryPage> => {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor !== undefined) query.set("cursor", cursor);
  return BriefingHistoryPageSchema.parse(
    await (await request(`/v1/briefings?${query}`)).json(),
  );
};

export const fetchInterests = async (): Promise<InterestPage> =>
  InterestPageSchema.parse(
    await (await request("/v1/interests?limit=100")).json(),
  );

export const createInterest = async (
  input: CreateInterest,
): Promise<UserInterest> =>
  UserInterestSchema.parse(
    await (
      await request("/v1/interests", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).json(),
  );

export const updateInterest = async (
  id: string,
  input: UpdateUserInterest,
): Promise<UserInterest> =>
  UserInterestSchema.parse(
    await (
      await request(`/v1/interests/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
    ).json(),
  );

export const deleteInterest = async (id: string): Promise<void> => {
  await request(`/v1/interests/${id}`, { method: "DELETE" });
};

export const fetchLibraryItems = async (
  kind: "saved" | "later",
  cursor?: string,
): Promise<LibraryItemPage> => {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor !== undefined) query.set("cursor", cursor);
  return LibraryItemPageSchema.parse(
    await (await request(`/v1/library/${kind}?${query}`)).json(),
  );
};

export const fetchBriefingItemStates = async (
  briefingId: string,
): Promise<BriefingItemState[]> =>
  BriefingItemStateListSchema.parse(
    await (await request(`/v1/briefings/${briefingId}/item-states`)).json(),
  ).items;

export const updateBriefingItemState = async (
  briefingItemId: string,
  input: UpdateBriefingItemState,
): Promise<BriefingItemState | null> => {
  const response = await request(`/v1/briefing-items/${briefingItemId}/state`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return response.status === 204
    ? null
    : BriefingItemStateSchema.parse(await response.json());
};

export const recordBriefingInteraction = async (
  briefingId: string,
  briefingItemId: string,
  interaction: CreateBriefingInteraction,
): Promise<void> => {
  await request(
    `/v1/briefings/${briefingId}/items/${briefingItemId}/interactions`,
    {
      method: "POST",
      body: JSON.stringify(interaction),
    },
  );
};

export const fetchCalendarAvailability =
  async (): Promise<CalendarAvailability> => {
    const now = encodeURIComponent(new Date().toISOString());
    return CalendarAvailabilitySchema.parse(
      await (
        await request(`/v1/calendar/availability?minimumMinutes=2&now=${now}`)
      ).json(),
    );
  };

export const disconnectCalendar = async (id: string): Promise<void> => {
  await request(`/v1/calendar/connections/${id}`, { method: "DELETE" });
};

export const completeOnboarding = async (
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> =>
  CompleteOnboardingResultSchema.parse(
    await (
      await request("/v1/onboarding", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).json(),
  );

export const upsertIdentityEmailEndpoint = async (
  email: string,
): Promise<DeliveryEndpoint> =>
  DeliveryEndpointSchema.parse(
    await (
      await request("/v1/delivery-endpoints", {
        method: "PUT",
        body: JSON.stringify({
          channel: "email",
          destination: email,
          enabled: true,
        }),
      })
    ).json(),
  );

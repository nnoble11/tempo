"use client";

import {
  CanonicalBriefingSchema,
  CompleteOnboardingResultSchema,
  DeliveryEndpointSchema,
  TodayBriefingResponseSchema,
  UserProfileSchema,
  type CanonicalBriefing,
  type CompleteOnboardingInput,
  type CompleteOnboardingResult,
  type DeliveryEndpoint,
  type TodayBriefingResponse,
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

import {
  CompleteOnboardingResultSchema,
  UserProfileSchema,
  type CompleteOnboardingInput,
  type CompleteOnboardingResult,
  type UserProfile,
  type UserPreferences,
  type UserPreferencesInput,
} from "@tempo/contracts";

import { authenticatedRequest } from "../../api/client";

export const fetchProfile = async (): Promise<UserProfile> => {
  const response = await authenticatedRequest("/v1/users/me");
  return UserProfileSchema.parse(await response.json());
};

export const completeOnboarding = async (
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> => {
  const response = await authenticatedRequest("/v1/onboarding", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return CompleteOnboardingResultSchema.parse(await response.json());
};

export const updatePreferences = async (
  input: UserPreferencesInput,
): Promise<UserPreferences> => {
  const response = await authenticatedRequest("/v1/preferences", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return UserProfileSchema.shape.preferences.parse(await response.json());
};

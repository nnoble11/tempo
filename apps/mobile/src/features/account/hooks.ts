import type { CompleteOnboardingInput } from "@tempo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { completeOnboarding, fetchProfile } from "./api";
import { upsertDeliveryEndpoint } from "../delivery/api";

export const profileQueryKey = (userId: string) =>
  ["users", "me", userId] as const;

export const useProfile = (userId: string | null) =>
  useQuery({
    queryKey: profileQueryKey(userId ?? "signed-out"),
    queryFn: fetchProfile,
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  });

export const useCompleteOnboarding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteOnboardingInput) => completeOnboarding(input),
    onSuccess: async ({ profile }) => {
      if (
        profile.user.email !== null &&
        profile.preferences.deliveryChannels.includes("email")
      ) {
        await upsertDeliveryEndpoint({
          channel: "email",
          destination: profile.user.email,
          enabled: true,
        });
      }
      const queryKey = profileQueryKey(profile.user.id);
      queryClient.setQueryData(queryKey, profile);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
};

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchProfile } from "./api";
import { useSession } from "./use-session";

export const useProtectedPage = (returnTo: string) => {
  const router = useRouter();
  const { session, loading } = useSession();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (session === null) {
      router.replace(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    void fetchProfile()
      .then((profile) => {
        if (profile.user.onboardingCompletedAt === null) {
          router.replace("/onboarding");
        } else {
          setReady(true);
        }
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Tempo is offline.",
        ),
      );
  }, [loading, returnTo, router, session]);

  return { ready, error };
};

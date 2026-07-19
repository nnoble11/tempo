"use client";

import type { CanonicalBriefing } from "@tempo/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchBriefing, fetchProfile, fetchToday } from "./api";
import { BriefingView } from "./BriefingView";
import { useSession } from "./use-session";

export function BriefingLoader({ briefingId }: { briefingId?: string }) {
  const router = useRouter();
  const { session, loading } = useSession();
  const [briefing, setBriefing] = useState<CanonicalBriefing | null>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (session === null) {
      router.replace(
        `/sign-in?returnTo=${encodeURIComponent(briefingId === undefined ? "/" : `/briefings/${briefingId}`)}`,
      );
      return;
    }
    void fetchProfile()
      .then((profile) => {
        if (profile.user.onboardingCompletedAt === null) {
          router.replace("/onboarding");
          return null;
        }
        return briefingId === undefined
          ? fetchToday().then(({ briefing: today }) => today)
          : fetchBriefing(briefingId);
      })
      .then((result) => {
        if (result !== null) setBriefing(result);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Tempo could not load this briefing.",
        ),
      );
  }, [briefingId, loading, router, session]);

  if (error !== null) {
    return <State title="Your briefing is out of reach" copy={error} />;
  }
  if (briefing === null) {
    return (
      <State
        title="You’re all caught up"
        copy="There are no meaningful updates waiting. Close the tab and keep your attention."
      />
    );
  }
  if (briefing === undefined) {
    return (
      <State
        title="Preparing your briefing"
        copy="Gathering the few updates that matter."
      />
    );
  }
  return <BriefingView briefing={briefing} />;
}

function State({ title, copy }: { title: string; copy: string }) {
  return (
    <main className="centerState">
      <a className="wordmark" href="/">
        tempo
      </a>
      <h1>{title}</h1>
      <p>{copy}</p>
    </main>
  );
}

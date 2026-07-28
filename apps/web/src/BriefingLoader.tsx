"use client";

import type { CanonicalBriefing } from "@tempo/contracts";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { fetchBriefing, fetchProfile, fetchToday } from "./api";
import { BriefingView } from "./BriefingView";
import { useSession } from "./use-session";

export function BriefingLoader({ briefingId }: { briefingId?: string }) {
  const router = useRouter();
  const { session, loading } = useSession();
  const [briefing, setBriefing] = useState<CanonicalBriefing | null>();
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (session === null) {
      router.replace(
        `/sign-in?returnTo=${encodeURIComponent(briefingId === undefined ? "/" : `/briefings/${briefingId}`)}`,
      );
      return;
    }
    setBriefing(undefined);
    setError(null);
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
  }, [briefingId, loading, retryToken, router, session]);

  if (error !== null) {
    return (
      <State
        title="Your briefing is out of reach"
        copy={error}
        action={
          <button
            className="primaryAction"
            onClick={() => setRetryToken((current) => current + 1)}
          >
            Try again
          </button>
        }
      />
    );
  }
  if (briefing === null) {
    return (
      <State
        title="You’re all caught up"
        copy="There are no meaningful updates waiting. Close the tab and keep your attention."
        action={
          <a className="secondaryLink" href="/interests">
            Review interests
          </a>
        }
      />
    );
  }
  if (briefing === undefined) {
    return (
      <State
        title="Preparing your briefing"
        copy="Gathering the few updates that matter."
        loading
      />
    );
  }
  return <BriefingView briefing={briefing} />;
}

function State({
  title,
  copy,
  loading = false,
  action,
}: {
  title: string;
  copy: string;
  loading?: boolean;
  action?: ReactNode;
}) {
  return (
    <main
      aria-busy={loading}
      aria-live="polite"
      className="centerState"
      id="main-content"
    >
      <a className="wordmark" href="/">
        tempo
      </a>
      {loading ? <span aria-hidden className="loadingMark" /> : null}
      <h1>{title}</h1>
      <p>{copy}</p>
      {action}
    </main>
  );
}

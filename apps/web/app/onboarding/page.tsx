"use client";

import type { DesiredDepth } from "@tempo/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { completeOnboarding, upsertIdentityEmailEndpoint } from "../../src/api";
import { useSession } from "../../src/use-session";

export default function OnboardingPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [minutes, setMinutes] = useState(5);
  const [dailyTime, setDailyTime] = useState("08:00");
  const [depth, setDepth] = useState<DesiredDepth>("standard");
  const [interests, setInterests] = useState("World news, Climate science");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session === null) {
      router.replace("/sign-in?returnTo=%2Fonboarding");
    }
  }, [loading, router, session]);

  const submit = async (): Promise<void> => {
    const names = [
      ...new Set(
        interests
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      ),
    ];
    if (names.length === 0) {
      setMessage("Add at least one interest.");
      return;
    }
    setBusy(true);
    try {
      const result = await completeOnboarding({
        preferences: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          locale: Intl.DateTimeFormat().resolvedOptions().locale || "en-US",
          defaultBriefingMinutes: minutes,
          dailyBriefingTime: dailyTime,
          quietHoursStart: "22:00",
          quietHoursEnd: "07:00",
          deliveryChannels: ["in_app", "email"],
          calendarSuggestionsEnabled: false,
          recommendationsEnabled: false,
        },
        interests: names.map((name) => ({
          type: "instruction",
          name,
          description: "Added during web onboarding",
          importance: 4,
          expertiseLevel: "intermediate",
          desiredDepth: depth,
          alertSensitivity: 1,
          preferredSources: [],
          blockedSources: [],
          keywords: [],
          excludedKeywords: [],
        })),
      });
      const identityEmail = result.profile.user.email;
      if (identityEmail !== null) {
        await upsertIdentityEmailEndpoint(identityEmail);
      }
      router.replace("/");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Tempo could not save your setup.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading || session === null) {
    return (
      <main className="centerState" id="main-content">
        <a className="wordmark" href="/">
          tempo
        </a>
        <h1>Preparing your setup</h1>
        <p>Checking your secure session.</p>
      </main>
    );
  }

  return (
    <main className="setupShell" id="main-content">
      <header>
        <a className="wordmark" href="/">
          tempo
        </a>
        <p>SET UP YOUR TEMPO</p>
      </header>
      <section className="setupHero">
        <p className="eyebrow">A BRIEFING SHAPED AROUND YOU</p>
        <h1>Decide what earns your attention.</h1>
      </section>
      <div className="setupGrid">
        <section className="setupCard">
          <span>01</span>
          <h2>How much time do you have?</h2>
          <div className="choiceRow">
            {[2, 5, 10, 15].map((value) => (
              <button
                className={minutes === value ? "choice selected" : "choice"}
                aria-pressed={minutes === value}
                key={value}
                onClick={() => setMinutes(value)}
                type="button"
              >
                {value} min
              </button>
            ))}
          </div>
          <label>
            Daily briefing time
            <input
              onChange={(event) => setDailyTime(event.target.value)}
              type="time"
              value={dailyTime}
            />
          </label>
        </section>
        <section className="setupCard">
          <span>02</span>
          <h2>What deserves your attention?</h2>
          <label>
            Interests, separated by commas
            <textarea
              onChange={(event) => setInterests(event.target.value)}
              rows={5}
              value={interests}
            />
          </label>
        </section>
        <section className="setupCard">
          <span>03</span>
          <h2>How should Tempo explain things?</h2>
          <div className="choiceRow">
            {(["brief", "standard", "deep"] as const).map((value) => (
              <button
                className={depth === value ? "choice selected" : "choice"}
                aria-pressed={depth === value}
                key={value}
                onClick={() => setDepth(value)}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
          <p className="muted">
            External delivery waits from 10 PM to 7 AM by default.
          </p>
        </section>
      </div>
      {message === null ? null : (
        <p aria-live="polite" className="formMessage" role="status">
          {message}
        </p>
      )}
      <button
        className="primaryLarge"
        disabled={busy}
        onClick={() => void submit()}
        type="button"
      >
        {busy ? "Saving…" : "Build my daily briefing"}
      </button>
    </main>
  );
}

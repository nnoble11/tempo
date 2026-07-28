"use client";

import type {
  BriefingItemState,
  CalendarAvailability,
  CanonicalBriefing,
} from "@tempo/contracts";
import { useEffect, useState } from "react";

import {
  fetchBriefingItemStates,
  fetchCalendarAvailability,
  recordBriefingInteraction,
  updateBriefingItemState,
} from "./api";
import { AppNavigation } from "./AppNavigation";

const uniqueSources = (briefing: CanonicalBriefing, itemIndex: number) => {
  const item = briefing.items[itemIndex];
  if (item === undefined) return [];
  const sources = item.claims.flatMap(({ citations }) => citations);
  return [
    ...new Map(sources.map((source) => [source.citationId, source])).values(),
  ];
};

// Mirrors the mobile presentation: the minimum claim confidence, so one weakly
// supported claim cannot hide behind stronger ones.
const itemConfidenceLabel = (
  item: CanonicalBriefing["items"][number],
): string | null => {
  if (item.claims.length === 0) return null;
  const value = Math.min(...item.claims.map((claim) => claim.confidence));
  const label = value >= 0.75 ? "High" : value >= 0.5 ? "Moderate" : "Low";
  return `${label} · ${Math.round(value * 100)}%`;
};

export function BriefingView({ briefing }: { briefing: CanonicalBriefing }) {
  const [states, setStates] = useState<BriefingItemState[]>([]);
  const [calendar, setCalendar] = useState<CalendarAvailability | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      fetchBriefingItemStates(briefing.id).then(setStates),
      fetchCalendarAvailability().then(setCalendar),
    ]).catch(() => {
      // The canonical briefing remains readable when optional state is offline.
    });
  }, [briefing.id]);

  const toggleState = async (
    itemId: string,
    kind: "saved" | "deferred",
    enabled: boolean,
  ): Promise<void> => {
    try {
      const updated = await updateBriefingItemState(
        itemId,
        kind === "saved" ? { saved: !enabled } : { deferred: !enabled },
      );
      setStates((current) => [
        ...current.filter(({ briefingItemId }) => briefingItemId !== itemId),
        ...(updated === null ? [] : [updated]),
      ]);
      if (!enabled) {
        void recordBriefingInteraction(briefing.id, itemId, {
          eventType: kind,
          value: {},
          idempotencyKey: `web:${kind}:${itemId}`,
        }).catch(() => {
          // Current state is canonical; a missing behavioral event must not
          // roll back a successful user-visible Save or Later transition.
        });
      }
      setMessage(kind === "saved" ? "Saved state updated." : "Later updated.");
    } catch {
      setMessage("That change did not save. Try again.");
    }
  };

  return (
    <main className="shell" id="main-content">
      <header className="topbar">
        <a className="wordmark" href="/">
          tempo
        </a>
        <AppNavigation />
        <div
          aria-label={`${Math.ceil(briefing.estimatedSeconds / 60)} minute briefing`}
          className="timePill"
        >
          {Math.ceil(briefing.estimatedSeconds / 60)} min
        </div>
      </header>
      <section aria-labelledby="briefing-overview" className="hero">
        <p className="eyebrow">WHY TODAY MATTERS</p>
        <h1 id="briefing-overview">{briefing.overview}</h1>
        <p className="muted">
          {briefing.items.length} meaningful updates · one clear end
        </p>
        <p className="briefingDate">
          <time dateTime={briefing.scheduledFor}>
            {new Date(briefing.scheduledFor).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </time>
        </p>
      </section>
      {calendar?.suggestion === null ||
      calendar?.suggestion === undefined ? null : (
        <a className="calendarBanner" href="/calendar">
          <span className="eyebrow">A GOOD MOMENT</span>
          <strong>
            You have {calendar.suggestion.availableMinutes} minutes.
          </strong>
          <span>
            A {calendar.suggestion.suggestedBriefingMinutes}-minute briefing
            fits before your next busy window.
          </span>
        </a>
      )}
      {message === null ? null : (
        <p aria-live="polite" className="inlineNotice" role="status">
          {message}
        </p>
      )}
      <div className="briefingGrid">
        {briefing.items.map((item, index) => {
          const state = states.find(
            ({ briefingItemId }) => briefingItemId === item.id,
          );
          const saved = state?.savedAt !== null && state?.savedAt !== undefined;
          const deferred =
            state?.deferredAt !== null && state?.deferredAt !== undefined;
          return (
            <article
              aria-labelledby={`briefing-item-${item.id}`}
              className="story"
              key={item.id}
            >
              <div className="storyMeta">
                <span>{String(item.position).padStart(2, "0")}</span>
                <span>{Math.ceil(item.estimatedSeconds / 60)} min</span>
              </div>
              <h2 id={`briefing-item-${item.id}`}>{item.headline}</h2>
              <p className="takeaway">{item.takeaway}</p>
              <div className="explanation">
                <p className="eyebrow">WHY IT MATTERS TO YOU</p>
                <p>{item.whyItMatters}</p>
                <p className="eyebrow">WHAT CHANGED</p>
                <p>{item.whatChanged}</p>
                {itemConfidenceLabel(item) === null ? null : (
                  <>
                    <p className="eyebrow">CONFIDENCE</p>
                    <p>{itemConfidenceLabel(item)}</p>
                  </>
                )}
              </div>
              <div className="sources">
                {uniqueSources(briefing, index).map((source) => (
                  <a
                    aria-label={`Open ${source.publisher}: ${source.sourceTitle} in a new tab`}
                    href={source.canonicalUrl}
                    key={source.citationId}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span>
                      <strong>{source.publisher}</strong>
                      <small>{source.sourceTitle}</small>
                    </span>
                    <span aria-hidden>↗</span>
                  </a>
                ))}
              </div>
              <div className="actionRow">
                <button
                  aria-pressed={saved}
                  className={saved ? "selectedAction" : ""}
                  onClick={() => void toggleState(item.id, "saved", saved)}
                  type="button"
                >
                  {saved ? "Saved ✓" : "Save"}
                </button>
                <button
                  aria-pressed={deferred}
                  className={deferred ? "selectedAction" : ""}
                  onClick={() =>
                    void toggleState(item.id, "deferred", deferred)
                  }
                  type="button"
                >
                  {deferred ? "Later ✓" : "Later"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <footer className="done">
        <span aria-hidden />
        <h2>You’re informed.</h2>
        <p>That’s the end of this briefing.</p>
      </footer>
    </main>
  );
}

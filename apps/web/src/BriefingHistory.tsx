"use client";

import type { BriefingSummary } from "@tempo/contracts";
import { useCallback, useEffect, useState } from "react";

import { fetchBriefingHistory } from "./api";
import { FeatureShell } from "./FeatureShell";
import { useProtectedPage } from "./use-protected-page";

export function BriefingHistory() {
  const protection = useProtectedPage("/history");
  const [items, setItems] = useState<BriefingSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchBriefingHistory();
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch {
      setError("History could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (protection.ready) {
      void loadInitial();
    }
  }, [loadInitial, protection.ready]);

  if (!protection.ready) {
    return (
      <main className="centerState" id="main-content">
        <h1>Preparing your history</h1>
        <p>{protection.error ?? "Checking your secure session."}</p>
      </main>
    );
  }

  return (
    <FeatureShell
      eyebrow="BRIEFING HISTORY"
      title="A finite record of what mattered."
      copy="Revisit any canonical briefing without creating another endless feed."
    >
      {error === null ? null : (
        <section className="featureCard emptyCard" role="alert">
          <h2>History is out of reach</h2>
          <p className="muted">{error}</p>
          <button
            className="primaryAction"
            onClick={() => void loadInitial()}
            type="button"
          >
            Try again
          </button>
        </section>
      )}
      {loading ? (
        <section
          aria-busy="true"
          aria-live="polite"
          className="featureCard emptyCard"
        >
          <p>Loading briefing history…</p>
        </section>
      ) : null}
      <div className="featureGrid">
        {items.map((briefing) => (
          <a
            className="featureCard linkedCard"
            href={`/briefings/${briefing.id}`}
            key={briefing.id}
          >
            <p className="eyebrow">
              <time dateTime={briefing.scheduledFor}>
                {new Date(briefing.scheduledFor).toLocaleDateString()}
              </time>{" "}
              · {Math.ceil(briefing.estimatedSeconds / 60)} MIN ·{" "}
              {briefing.itemCount} UPDATES
            </p>
            <h2>{briefing.overview}</h2>
            <span>Open briefing →</span>
          </a>
        ))}
      </div>
      {!loading && items.length === 0 && error === null ? (
        <section className="featureCard emptyCard">
          <p>No previous briefings yet.</p>
        </section>
      ) : null}
      {nextCursor === null ? null : (
        <button
          className="secondaryAction loadMore"
          disabled={loadingMore}
          onClick={() =>
            void (async () => {
              setLoadingMore(true);
              setError(null);
              try {
                const page = await fetchBriefingHistory(nextCursor);
                setItems((current) => [...current, ...page.items]);
                setNextCursor(page.nextCursor);
              } catch {
                setError("Older history could not be loaded.");
              } finally {
                setLoadingMore(false);
              }
            })()
          }
          type="button"
        >
          {loadingMore ? "Loading…" : "Load older briefings"}
        </button>
      )}
    </FeatureShell>
  );
}

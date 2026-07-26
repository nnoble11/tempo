"use client";

import type { BriefingSummary } from "@tempo/contracts";
import { useEffect, useState } from "react";

import { fetchBriefingHistory } from "./api";
import { FeatureShell } from "./FeatureShell";
import { useProtectedPage } from "./use-protected-page";

export function BriefingHistory() {
  const protection = useProtectedPage("/history");
  const [items, setItems] = useState<BriefingSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (protection.ready) {
      void fetchBriefingHistory()
        .then((page) => {
          setItems(page.items);
          setNextCursor(page.nextCursor);
        })
        .catch(() => setError("History could not be loaded."))
        .finally(() => setLoading(false));
    }
  }, [protection.ready]);

  if (!protection.ready) {
    return (
      <main className="centerState">
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
      {error === null ? null : <p className="formMessage">{error}</p>}
      {loading ? (
        <section className="featureCard emptyCard">
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
              {new Date(briefing.scheduledFor).toLocaleDateString()} ·{" "}
              {Math.ceil(briefing.estimatedSeconds / 60)} MIN ·{" "}
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
          onClick={() =>
            void fetchBriefingHistory(nextCursor)
              .then((page) => {
                setItems((current) => [...current, ...page.items]);
                setNextCursor(page.nextCursor);
              })
              .catch(() => setError("Older history could not be loaded."))
          }
        >
          Load older briefings
        </button>
      )}
    </FeatureShell>
  );
}

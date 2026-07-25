"use client";

import type { CanonicalBriefing } from "@tempo/contracts";

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
  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          tempo
        </a>
        <div className="timePill">
          {Math.ceil(briefing.estimatedSeconds / 60)} min
        </div>
      </header>
      <section className="hero">
        <p className="eyebrow">WHY TODAY MATTERS</p>
        <h1>{briefing.overview}</h1>
        <p className="muted">
          {briefing.items.length} meaningful updates · one clear end
        </p>
      </section>
      <div className="briefingGrid">
        {briefing.items.map((item, index) => (
          <article className="story" key={item.id}>
            <div className="storyMeta">
              <span>{String(item.position).padStart(2, "0")}</span>
              <span>{Math.ceil(item.estimatedSeconds / 60)} min</span>
            </div>
            <h2>{item.headline}</h2>
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
          </article>
        ))}
      </div>
      <footer className="done">
        <span />
        <h2>You’re informed.</h2>
        <p>That’s the end of this briefing.</p>
      </footer>
    </main>
  );
}

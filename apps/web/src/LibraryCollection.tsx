"use client";

import type { LibraryItem } from "@tempo/contracts";
import { useCallback, useEffect, useState } from "react";

import { fetchLibraryItems, updateBriefingItemState } from "./api";
import { FeatureShell } from "./FeatureShell";
import { useProtectedPage } from "./use-protected-page";

export function LibraryCollection({ kind }: { kind: "saved" | "later" }) {
  const protection = useProtectedPage(`/${kind}`);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const title = kind === "saved" ? "Saved" : "Later";
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchLibraryItems(kind);
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    if (protection.ready) {
      void load().catch(() => setError("This collection could not be loaded."));
    }
  }, [load, protection.ready]);

  if (!protection.ready) {
    return (
      <main className="centerState">
        <h1>Preparing {title}</h1>
        <p>{protection.error ?? "Checking your secure session."}</p>
      </main>
    );
  }

  return (
    <FeatureShell
      eyebrow={title.toUpperCase()}
      title={
        kind === "saved"
          ? "Keep the updates worth returning to."
          : "Set something aside without losing it."
      }
      copy="Your library is durable and shared with the iOS app."
    >
      {error === null ? null : <p className="formMessage">{error}</p>}
      {loading && items.length === 0 ? (
        <section className="featureCard emptyCard">
          <p>Loading {title}…</p>
        </section>
      ) : null}
      <div className="featureGrid">
        {items.map(({ state, briefing, item }) => (
          <article className="featureCard" key={state.id}>
            <p className="eyebrow">
              {new Date(briefing.scheduledFor).toLocaleDateString()} ·{" "}
              {Math.ceil(item.estimatedSeconds / 60)} MIN
            </p>
            <h2>{item.headline}</h2>
            <p className="muted">{item.takeaway}</p>
            <div className="actionRow">
              <a className="primaryLink" href={`/briefings/${briefing.id}`}>
                Open briefing
              </a>
              <button
                onClick={() =>
                  void updateBriefingItemState(
                    item.id,
                    kind === "saved" ? { saved: false } : { deferred: false },
                  ).then(load)
                }
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      {nextCursor === null ? null : (
        <button
          onClick={() =>
            void fetchLibraryItems(kind, nextCursor)
              .then((page) => {
                setItems((current) => [...current, ...page.items]);
                setNextCursor(page.nextCursor);
              })
              .catch(() => setError("More items could not be loaded."))
          }
        >
          Load more
        </button>
      )}
      {!loading && items.length === 0 && error === null ? (
        <section className="featureCard emptyCard">
          <p>Nothing {kind === "saved" ? "saved" : "waiting"} yet.</p>
          <a className="primaryLink" href="/">
            Return to Today
          </a>
        </section>
      ) : null}
    </FeatureShell>
  );
}

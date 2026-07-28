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
  const [loadingMore, setLoadingMore] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const title = kind === "saved" ? "Saved" : "Later";
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchLibraryItems(kind);
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch {
      setError("This collection could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  const removeItem = async (briefingItemId: string): Promise<void> => {
    const previousItems = items;
    setError(null);
    setRemovingItemId(briefingItemId);
    setItems((current) =>
      current.filter(({ item }) => item.id !== briefingItemId),
    );
    try {
      await updateBriefingItemState(
        briefingItemId,
        kind === "saved" ? { saved: false } : { deferred: false },
      );
    } catch {
      setItems(previousItems);
      setError(`This item could not be removed from ${title}. Try again.`);
    } finally {
      setRemovingItemId(null);
    }
  };

  const loadMore = async (): Promise<void> => {
    if (nextCursor === null || loadingMore) return;
    setError(null);
    setLoadingMore(true);
    try {
      const page = await fetchLibraryItems(kind, nextCursor);
      setItems((current) => [
        ...current,
        ...page.items.filter(
          ({ item }) =>
            !current.some((currentItem) => currentItem.item.id === item.id),
        ),
      ]);
      setNextCursor(page.nextCursor);
    } catch {
      setError("More items could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (protection.ready) {
      void load();
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
      {error === null ? null : (
        <div aria-live="polite" className="formMessage">
          <p>{error}</p>
          {items.length === 0 ? (
            <button onClick={() => void load()}>Retry</button>
          ) : null}
        </div>
      )}
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
                aria-label={`Remove ${item.headline} from ${title}`}
                disabled={removingItemId !== null}
                onClick={() => void removeItem(item.id)}
              >
                {removingItemId === item.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {nextCursor === null ? null : (
        <button disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? "Loading…" : "Load more"}
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

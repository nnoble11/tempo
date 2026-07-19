import type {
  NormalizedSourceItem,
  Source,
  SourceItemUpsertResult,
  SourceRegistration,
  StoredSourceItem,
} from "@tempo/contracts";
import type {
  ClaimedSource,
  ClaimDueSourcesCommand,
  RecordSourceFetchFailureCommand,
  RecordSourceFetchSuccessCommand,
  SourceRepository,
} from "@tempo/database";
import {
  SourceHttpError,
  type HttpFetcher,
  type SourceAdapter,
} from "@tempo/source-adapters";
import { describe, expect, it } from "vitest";

import { runIngestionCycle, type IngestionClock } from "../src/index.js";

const source: SourceRegistration = {
  key: "nasa-news",
  name: "NASA News Releases",
  homepageUrl: "https://www.nasa.gov/news-release/",
  feedUrl: "https://www.nasa.gov/news-release/feed/",
  adapterKind: "rss",
  defaultLanguage: "en-US",
  fetchIntervalMinutes: 30,
};

const claimedSource = (
  overrides: Partial<ClaimedSource> = {},
): ClaimedSource => ({
  source,
  etag: '"existing-etag"',
  lastModified: "Fri, 17 Jul 2026 19:00:00 GMT",
  consecutiveFailures: 0,
  ...overrides,
});

class TestSourceRepository implements SourceRepository {
  public claimed: ClaimedSource[] = [];
  public claimCommands: ClaimDueSourcesCommand[] = [];
  public registrations: SourceRegistration[] = [];
  public successes: RecordSourceFetchSuccessCommand[] = [];
  public failures: RecordSourceFetchFailureCommand[] = [];
  public upserts: {
    sourceKey: string;
    items: readonly NormalizedSourceItem[];
  }[] = [];
  public upsertResult: SourceItemUpsertResult = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
  };

  public registerSource(registration: SourceRegistration): Promise<Source> {
    this.registrations.push(registration);
    return Promise.resolve({
      ...registration,
      id: "00000000-0000-4000-8000-000000000001",
      active: true,
      createdAt: "2026-07-17T20:00:00.000Z",
      updatedAt: "2026-07-17T20:00:00.000Z",
    });
  }

  public claimDueSources(
    command: ClaimDueSourcesCommand,
  ): Promise<ClaimedSource[]> {
    this.claimCommands.push(command);
    return Promise.resolve(this.claimed);
  }

  public recordSourceFetchSuccess(
    command: RecordSourceFetchSuccessCommand,
  ): Promise<void> {
    this.successes.push(command);
    return Promise.resolve();
  }

  public recordSourceFetchFailure(
    command: RecordSourceFetchFailureCommand,
  ): Promise<void> {
    this.failures.push(command);
    return Promise.resolve();
  }

  public upsertSourceItems(
    sourceKey: string,
    items: readonly NormalizedSourceItem[],
  ): Promise<SourceItemUpsertResult> {
    this.upserts.push({ sourceKey, items });
    return Promise.resolve(this.upsertResult);
  }

  public listSourceItems(): Promise<StoredSourceItem[]> {
    return Promise.resolve([]);
  }
}

const fixedClock = (
  current = "2026-07-17T20:00:00.000Z",
): { clock: IngestionClock; sleeps: number[] } => {
  const sleeps: number[] = [];
  return {
    clock: {
      now: () => new Date(current),
      sleep: (milliseconds) => {
        sleeps.push(milliseconds);
        return Promise.resolve();
      },
    },
    sleeps,
  };
};

const unusedFetcher: HttpFetcher = {
  get: () =>
    Promise.reject(new Error("The adapter test double fetches itself.")),
};

describe("scheduled ingestion cycle", () => {
  it("retries transient failures, preserves 304 validators, and schedules success", async () => {
    const repository = new TestSourceRepository();
    repository.claimed = [claimedSource()];
    const { clock, sleeps } = fixedClock();
    let fetchAttempts = 0;
    const adapter: SourceAdapter = {
      source,
      fetch: () => {
        fetchAttempts += 1;
        if (fetchAttempts < 3) {
          return Promise.reject(new SourceHttpError(503, source.feedUrl));
        }
        return Promise.resolve({
          items: [],
          rejected: [],
          notModified: true,
          etag: null,
          lastModified: null,
        });
      },
    };

    const summary = await runIngestionCycle({
      adapters: [adapter],
      repository,
      fetcher: unusedFetcher,
      workerId: "worker-1",
      clock,
      retryPolicy: {
        maxAttempts: 3,
        baseDelayMilliseconds: 100,
        maxDelayMilliseconds: 1_000,
      },
    });

    expect(repository.registrations).toEqual([source]);
    expect(repository.claimCommands).toEqual([
      {
        workerId: "worker-1",
        now: "2026-07-17T20:00:00.000Z",
        leaseUntil: "2026-07-17T20:10:00.000Z",
        sourceKeys: ["nasa-news"],
        limit: 10,
      },
    ]);
    expect(sleeps).toEqual([100, 200]);
    expect(repository.successes).toEqual([
      {
        sourceKey: "nasa-news",
        workerId: "worker-1",
        fetchedAt: "2026-07-17T20:00:00.000Z",
        nextFetchAt: "2026-07-17T20:30:00.000Z",
        etag: '"existing-etag"',
        lastModified: "Fri, 17 Jul 2026 19:00:00 GMT",
      },
    ]);
    expect(summary).toEqual({
      workerId: "worker-1",
      claimed: 1,
      outcomes: [
        {
          sourceKey: "nasa-news",
          status: "not_modified",
          attempts: 3,
          rejected: 0,
          upsert: {
            inserted: 0,
            updated: 0,
            unchanged: 0,
          },
        },
      ],
    });
  });

  it("does not retry permanent HTTP failures and applies scheduled backoff", async () => {
    const repository = new TestSourceRepository();
    repository.claimed = [
      claimedSource({
        consecutiveFailures: 2,
      }),
    ];
    const { clock, sleeps } = fixedClock();
    const adapter: SourceAdapter = {
      source,
      fetch: () => Promise.reject(new SourceHttpError(404, source.feedUrl)),
    };

    const summary = await runIngestionCycle({
      adapters: [adapter],
      repository,
      fetcher: unusedFetcher,
      workerId: "worker-2",
      clock,
      failureBackoff: {
        baseDelayMilliseconds: 1_000,
        maxDelayMilliseconds: 10_000,
      },
    });

    expect(sleeps).toEqual([]);
    expect(repository.failures).toEqual([
      {
        sourceKey: "nasa-news",
        workerId: "worker-2",
        attemptedAt: "2026-07-17T20:00:00.000Z",
        nextFetchAt: "2026-07-17T20:00:04.000Z",
        error:
          "SourceHttpError: Source request failed with HTTP 404 for https://www.nasa.gov/news-release/feed/",
      },
    ]);
    expect(summary.outcomes[0]).toMatchObject({
      sourceKey: "nasa-news",
      status: "failed",
      attempts: 1,
    });
  });

  it("persists valid items while retaining per-entry rejection counts", async () => {
    const repository = new TestSourceRepository();
    repository.claimed = [claimedSource()];
    repository.upsertResult = {
      inserted: 1,
      updated: 0,
      unchanged: 0,
    };
    const item: NormalizedSourceItem = {
      sourceKey: source.key,
      externalId: "release-1",
      canonicalUrl: "https://www.nasa.gov/news-release/release-1/",
      title: "NASA publishes a release",
      author: "NASA",
      publishedAt: "2026-07-17T19:30:00.000Z",
      discoveredAt: "2026-07-17T20:00:00.000Z",
      language: "en-US",
      excerpt: "A grounded excerpt.",
      contentHash: "a".repeat(64),
      metadata: {},
    };
    const adapter: SourceAdapter = {
      source,
      fetch: () =>
        Promise.resolve({
          items: [item],
          rejected: [{ index: 1, reason: "Missing title." }],
          notModified: false,
          etag: '"new-etag"',
          lastModified: "Fri, 17 Jul 2026 19:30:00 GMT",
        }),
    };

    const summary = await runIngestionCycle({
      adapters: [adapter],
      repository,
      fetcher: unusedFetcher,
      workerId: "worker-3",
      clock: fixedClock().clock,
    });

    expect(repository.upserts).toEqual([
      {
        sourceKey: "nasa-news",
        items: [item],
      },
    ]);
    expect(summary.outcomes[0]).toEqual({
      sourceKey: "nasa-news",
      status: "succeeded",
      attempts: 1,
      rejected: 1,
      upsert: {
        inserted: 1,
        updated: 0,
        unchanged: 0,
      },
    });
  });
});

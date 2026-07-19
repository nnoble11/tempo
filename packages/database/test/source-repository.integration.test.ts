import type { NormalizedSourceItem } from "@tempo/contracts";
import {
  createDatabasePool,
  PostgresSourceRepository,
  runMigrations,
} from "@tempo/database";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  startTestPostgres,
  type TestPostgres,
} from "../../../test/support/postgres.js";

describe("source repository", () => {
  let postgres: TestPostgres;
  let pool: Pool;
  let repository: PostgresSourceRepository;

  beforeAll(async () => {
    postgres = await startTestPostgres();
    pool = createDatabasePool({
      connectionString: postgres.connectionString,
      maxConnections: 3,
    });
    await runMigrations(pool);
    repository = new PostgresSourceRepository(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it("registers sources and distinguishes inserted, unchanged, and updated items", async () => {
    const source = await repository.registerSource({
      key: "nasa-news",
      name: "NASA News Releases",
      homepageUrl: "https://www.nasa.gov/news-release/",
      feedUrl: "https://www.nasa.gov/news-release/feed/",
      adapterKind: "rss",
      defaultLanguage: "en-US",
      fetchIntervalMinutes: 30,
    });
    expect(source.key).toBe("nasa-news");

    const item: NormalizedSourceItem = {
      sourceKey: "nasa-news",
      externalId: "release-1",
      canonicalUrl: "https://www.nasa.gov/news-release/release-1/",
      title: "First release",
      author: "NASA",
      publishedAt: "2026-07-17T18:00:00.000Z",
      discoveredAt: "2026-07-17T19:00:00.000Z",
      language: "en-US",
      excerpt: "A grounded excerpt.",
      contentHash: "a".repeat(64),
      metadata: {
        categories: ["Science"],
      },
    };

    await expect(
      repository.upsertSourceItems("nasa-news", [item]),
    ).resolves.toEqual({
      inserted: 1,
      updated: 0,
      unchanged: 0,
    });
    await expect(
      repository.upsertSourceItems("nasa-news", [item]),
    ).resolves.toEqual({
      inserted: 0,
      updated: 0,
      unchanged: 1,
    });
    await expect(
      repository.upsertSourceItems("nasa-news", [
        {
          ...item,
          title: "Updated release",
          contentHash: "b".repeat(64),
        },
      ]),
    ).resolves.toEqual({
      inserted: 0,
      updated: 1,
      unchanged: 0,
    });

    const stored = await repository.listSourceItems("nasa-news", {
      limit: 10,
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      sourceId: source.id,
      sourceKey: "nasa-news",
      externalId: "release-1",
      title: "Updated release",
      discoveredAt: item.discoveredAt,
      metadata: {
        categories: ["Science"],
      },
    });
  });

  it("leases due sources, reclaims expired work, and persists fetch outcomes", async () => {
    await repository.registerSource({
      key: "lease-test",
      name: "Lease Test Source",
      homepageUrl: "https://example.com/news/",
      feedUrl: "https://example.com/news/feed.xml",
      adapterKind: "rss",
      defaultLanguage: "en-US",
      fetchIntervalMinutes: 30,
    });
    await pool.query("UPDATE sources SET next_fetch_at = $2 WHERE key = $1", [
      "lease-test",
      "2026-07-17T20:00:00.000Z",
    ]);

    const firstClaim = await repository.claimDueSources({
      workerId: "worker-1",
      now: "2026-07-17T20:00:00.000Z",
      leaseUntil: "2026-07-17T20:10:00.000Z",
      sourceKeys: ["lease-test"],
      limit: 1,
    });
    expect(firstClaim).toEqual([
      {
        source: {
          key: "lease-test",
          name: "Lease Test Source",
          homepageUrl: "https://example.com/news/",
          feedUrl: "https://example.com/news/feed.xml",
          adapterKind: "rss",
          defaultLanguage: "en-US",
          fetchIntervalMinutes: 30,
        },
        etag: null,
        lastModified: null,
        consecutiveFailures: 0,
      },
    ]);

    await expect(
      repository.claimDueSources({
        workerId: "worker-2",
        now: "2026-07-17T20:09:00.000Z",
        leaseUntil: "2026-07-17T20:19:00.000Z",
        sourceKeys: ["lease-test"],
        limit: 1,
      }),
    ).resolves.toEqual([]);

    const reclaimed = await repository.claimDueSources({
      workerId: "worker-2",
      now: "2026-07-17T20:11:00.000Z",
      leaseUntil: "2026-07-17T20:21:00.000Z",
      sourceKeys: ["lease-test"],
      limit: 1,
    });
    expect(reclaimed).toHaveLength(1);

    await repository.recordSourceFetchFailure({
      sourceKey: "lease-test",
      workerId: "worker-2",
      attemptedAt: "2026-07-17T20:11:00.000Z",
      nextFetchAt: "2026-07-17T20:16:00.000Z",
      error: "SourceHttpError: temporary failure",
    });
    await expect(
      repository.claimDueSources({
        workerId: "worker-3",
        now: "2026-07-17T20:15:59.000Z",
        leaseUntil: "2026-07-17T20:25:59.000Z",
        sourceKeys: ["lease-test"],
        limit: 1,
      }),
    ).resolves.toEqual([]);

    const retryClaim = await repository.claimDueSources({
      workerId: "worker-3",
      now: "2026-07-17T20:16:00.000Z",
      leaseUntil: "2026-07-17T20:26:00.000Z",
      sourceKeys: ["lease-test"],
      limit: 1,
    });
    expect(retryClaim[0]?.consecutiveFailures).toBe(1);

    await repository.recordSourceFetchSuccess({
      sourceKey: "lease-test",
      workerId: "worker-3",
      fetchedAt: "2026-07-17T20:16:00.000Z",
      nextFetchAt: "2026-07-17T20:46:00.000Z",
      etag: '"current-etag"',
      lastModified: "Fri, 17 Jul 2026 20:16:00 GMT",
    });

    const state = await pool.query<{
      etag: string | null;
      last_modified: string | null;
      consecutive_failures: number;
      next_fetch_at: Date;
      fetch_lease_owner: string | null;
      last_error: string | null;
    }>(
      `
        SELECT
          etag,
          last_modified,
          consecutive_failures,
          next_fetch_at,
          fetch_lease_owner,
          last_error
        FROM sources
        WHERE key = $1
      `,
      ["lease-test"],
    );
    expect(state.rows[0]).toMatchObject({
      etag: '"current-etag"',
      last_modified: "Fri, 17 Jul 2026 20:16:00 GMT",
      consecutive_failures: 0,
      fetch_lease_owner: null,
      last_error: null,
    });
    expect(state.rows[0]?.next_fetch_at.toISOString()).toBe(
      "2026-07-17T20:46:00.000Z",
    );
  });
});

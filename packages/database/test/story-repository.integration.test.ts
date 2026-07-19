import type {
  NormalizedSourceItem,
  StoryIntelligenceDraft,
} from "@tempo/contracts";
import {
  createDatabasePool,
  PostgresSourceRepository,
  PostgresStoryRepository,
  runMigrations,
} from "@tempo/database";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  startTestPostgres,
  type TestPostgres,
} from "../../../test/support/postgres.js";

const requireValue = <Value>(
  value: Value | undefined,
  description: string,
): Value => {
  if (value === undefined) {
    throw new Error(`Missing test fixture value: ${description}`);
  }
  return value;
};

describe("story intelligence repository", () => {
  let postgres: TestPostgres;
  let pool: Pool;
  let sourceRepository: PostgresSourceRepository;
  let storyRepository: PostgresStoryRepository;
  let nasaItemId: string;
  let federalReserveItemId: string;

  beforeAll(async () => {
    postgres = await startTestPostgres();
    pool = createDatabasePool({
      connectionString: postgres.connectionString,
      maxConnections: 4,
    });
    await runMigrations(pool);
    sourceRepository = new PostgresSourceRepository(pool);
    storyRepository = new PostgresStoryRepository(pool);

    await sourceRepository.registerSource({
      key: "nasa-news",
      name: "NASA News Releases",
      homepageUrl: "https://www.nasa.gov/news-release/",
      feedUrl: "https://www.nasa.gov/news-release/feed/",
      adapterKind: "rss",
      defaultLanguage: "en-US",
      fetchIntervalMinutes: 30,
    });
    await sourceRepository.registerSource({
      key: "federal-reserve-press",
      name: "Federal Reserve Press Releases",
      homepageUrl:
        "https://www.federalreserve.gov/newsevents/pressreleases.htm",
      feedUrl: "https://www.federalreserve.gov/feeds/press_all.xml",
      adapterKind: "rss",
      defaultLanguage: "en-US",
      fetchIntervalMinutes: 15,
    });

    const items: NormalizedSourceItem[] = [
      {
        sourceKey: "nasa-news",
        externalId: "nasa-release-1",
        canonicalUrl: "https://www.nasa.gov/news-release/earth-mission-update/",
        title: "NASA updates Earth science mission schedule",
        author: "NASA",
        publishedAt: "2026-07-17T14:30:00.000Z",
        discoveredAt: "2026-07-17T15:00:00.000Z",
        language: "en-US",
        excerpt: "NASA moved the mission launch into early 2027.",
        contentHash: "a".repeat(64),
        metadata: {},
      },
      {
        sourceKey: "federal-reserve-press",
        externalId: "fed-release-1",
        canonicalUrl:
          "https://www.federalreserve.gov/newsevents/pressreleases/test.htm",
        title: "Federal Reserve publishes supporting economic context",
        author: "Federal Reserve Board",
        publishedAt: "2026-07-17T16:00:00.000Z",
        discoveredAt: "2026-07-17T16:05:00.000Z",
        language: "en-US",
        excerpt: "The release provides economic context for the schedule.",
        contentHash: "b".repeat(64),
        metadata: {},
      },
    ];
    await sourceRepository.upsertSourceItems("nasa-news", [
      requireValue(items[0], "NASA source item"),
    ]);
    await sourceRepository.upsertSourceItems("federal-reserve-press", [
      requireValue(items[1], "Federal Reserve source item"),
    ]);

    const nasaItems = await sourceRepository.listSourceItems("nasa-news", {
      limit: 1,
    });
    const federalReserveItems = await sourceRepository.listSourceItems(
      "federal-reserve-press",
      { limit: 1 },
    );
    nasaItemId = requireValue(nasaItems[0], "stored NASA source item").id;
    federalReserveItemId = requireValue(
      federalReserveItems[0],
      "stored Federal Reserve source item",
    ).id;
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  const storyDraft = (): StoryIntelligenceDraft => ({
    cluster: {
      deduplicationKey: "earth-mission-schedule-2026",
      canonicalTitle: "NASA updates an Earth mission schedule",
      summary:
        "NASA changed the expected timing for an upcoming Earth science mission.",
      firstSeenAt: "2026-07-17T14:30:00.000Z",
      lastUpdatedAt: "2026-07-17T16:00:00.000Z",
      status: "active",
      sourceItems: [
        {
          sourceItemId: nasaItemId,
          membershipScore: 1,
          isPrimary: true,
        },
        {
          sourceItemId: federalReserveItemId,
          membershipScore: 0.7,
          isPrimary: false,
        },
      ],
    },
    claims: [
      {
        key: "schedule-change",
        kind: "source_fact",
        text: "NASA moved the expected mission launch into early 2027.",
        confidence: 0.98,
        isContested: false,
        citations: [
          {
            sourceItemId: nasaItemId,
            supportType: "direct",
            supportingText: "NASA moved the mission launch into early 2027.",
          },
        ],
      },
      {
        key: "economic-context",
        kind: "inference",
        text: "Current economic conditions may affect the mission schedule.",
        confidence: 0.55,
        isContested: false,
        citations: [
          {
            sourceItemId: federalReserveItemId,
            supportType: "context",
            supportingText:
              "The release provides economic context for the schedule.",
          },
        ],
      },
    ],
    candidate: {
      key: "default",
      headline: "NASA moves an Earth mission launch into 2027",
      takeaway:
        "NASA changed the expected launch timing for an Earth science mission.",
      whatChanged: "The expected launch moved from 2026 into early 2027.",
      estimatedSeconds: 55,
      language: "en-US",
      contentClass: "editorial",
      status: "ready",
      baselineScores: {
        globalImportance: 0.65,
        novelty: 0.9,
        urgency: 0.25,
        credibility: 0.95,
        sourceDiversity: 0.7,
        recency: 0.98,
        clickbaitPenalty: 0,
        confidence: 0.9,
      },
      claimKeys: ["schedule-change", "economic-context"],
      promptVersion: "candidate-v1",
      modelVersion: "fixture-model",
    },
  });

  it("stores grounded provenance and reusable candidate scores", async () => {
    const stored = await storyRepository.saveStoryIntelligence(storyDraft());

    expect(stored.cluster.sourceItems).toHaveLength(2);
    expect(stored.claims).toHaveLength(2);
    expect(stored.claims[0]?.citations[0]).toMatchObject({
      sourceItemId: federalReserveItemId,
      publisher: "Federal Reserve Press Releases",
      canonicalUrl:
        "https://www.federalreserve.gov/newsevents/pressreleases/test.htm",
    });
    const scheduleClaim = stored.claims.find(
      ({ key }) => key === "schedule-change",
    );
    expect(scheduleClaim?.citations[0]).toMatchObject({
      sourceItemId: nasaItemId,
      publisher: "NASA News Releases",
      canonicalUrl: "https://www.nasa.gov/news-release/earth-mission-update/",
      supportType: "direct",
    });
    expect(stored.candidate.baselineScores).toEqual({
      globalImportance: 0.65,
      novelty: 0.9,
      urgency: 0.25,
      credibility: 0.95,
      sourceDiversity: 0.7,
      recency: 0.98,
      clickbaitPenalty: 0,
      confidence: 0.9,
    });
    expect(stored.candidate.claimIds).toEqual(
      storyDraft().candidate.claimKeys.map(
        (claimKey) =>
          requireValue(
            stored.claims.find(({ key }) => key === claimKey),
            `stored claim ${claimKey}`,
          ).id,
      ),
    );
    await expect(storyRepository.listReadyCandidates(10)).resolves.toEqual([
      stored.candidate,
    ]);
  });

  it("updates the aggregate idempotently while preserving stable identities", async () => {
    const initial = await storyRepository.saveStoryIntelligence(storyDraft());
    const revisedDraft = storyDraft();
    revisedDraft.cluster.canonicalTitle =
      "NASA shifts an Earth mission launch to early 2027";
    revisedDraft.cluster.lastUpdatedAt = "2026-07-17T18:00:00.000Z";
    revisedDraft.cluster.sourceItems = [
      {
        sourceItemId: nasaItemId,
        membershipScore: 1,
        isPrimary: true,
      },
    ];
    revisedDraft.claims = [
      {
        ...requireValue(revisedDraft.claims[0], "schedule-change claim"),
        text: "NASA shifted the expected mission launch into early 2027.",
        confidence: 0.99,
      },
    ];
    revisedDraft.candidate.headline =
      "NASA shifts an Earth mission launch into early 2027";
    revisedDraft.candidate.claimKeys = ["schedule-change"];

    const revised = await storyRepository.saveStoryIntelligence(revisedDraft);

    expect(revised.cluster.id).toBe(initial.cluster.id);
    expect(revised.candidate.id).toBe(initial.candidate.id);
    expect(revised.claims[0]?.id).toBe(
      initial.claims.find(({ key }) => key === "schedule-change")?.id,
    );
    expect(revised.cluster.sourceItems).toHaveLength(1);
    expect(revised.claims).toHaveLength(1);
    expect(revised.candidate.claimIds).toEqual([revised.claims[0]?.id]);
    expect(revised.cluster.lastUpdatedAt).toBe("2026-07-17T18:00:00.000Z");

    const counts = await pool.query<{
      clusters: number;
      candidates: number;
      claims: number;
      citations: number;
    }>(
      `
        SELECT
          (SELECT COUNT(*)::INTEGER FROM story_clusters) AS clusters,
          (SELECT COUNT(*)::INTEGER FROM candidate_updates) AS candidates,
          (SELECT COUNT(*)::INTEGER FROM claims) AS claims,
          (SELECT COUNT(*)::INTEGER FROM citations) AS citations
      `,
    );
    expect(counts.rows[0]).toEqual({
      clusters: 1,
      candidates: 1,
      claims: 1,
      citations: 1,
    });
  });
});

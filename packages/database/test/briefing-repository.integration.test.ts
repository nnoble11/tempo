import type {
  GroundedBriefingGenerationRequest,
  NormalizedSourceItem,
  RankingComponents,
  StoryIntelligenceDraft,
} from "@tempo/contracts";
import {
  createDatabasePool,
  IdempotencyConflictError,
  PostgresAccountRepository,
  PostgresBriefingRepository,
  PostgresSourceRepository,
  PostgresStoryRepository,
  runMigrations,
} from "@tempo/database";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateAndSaveGroundedBriefing } from "../../domain/src/index.js";
import {
  startTestPostgres,
  type TestPostgres,
} from "../../../test/support/postgres.js";

const aliceId = "00000000-0000-4000-8000-000000000010";
const bobId = "00000000-0000-4000-8000-000000000011";

const rankingComponents: RankingComponents = {
  personalRelevance: 0.95,
  globalImportance: 0.7,
  novelty: 0.9,
  urgency: 0.3,
  credibility: 0.98,
  sourceDiversity: 0.4,
  interestStrength: 1,
  behavioralAffinity: 0.6,
  recency: 0.95,
  timingFit: 0.9,
  redundancyPenalty: 0,
  fatiguePenalty: 0,
  clickbaitPenalty: 0,
  commercialContentPenalty: 0,
  confidence: 0.96,
};

describe("canonical briefing repository", () => {
  let postgres: TestPostgres;
  let pool: Pool;
  let briefingRepository: PostgresBriefingRepository;
  let generationRequest: GroundedBriefingGenerationRequest;
  let storyRepository: PostgresStoryRepository;
  let storyDraft: StoryIntelligenceDraft;

  beforeAll(async () => {
    postgres = await startTestPostgres();
    pool = createDatabasePool({
      connectionString: postgres.connectionString,
      maxConnections: 4,
    });
    await runMigrations(pool);

    const accountRepository = new PostgresAccountRepository(pool);
    const sourceRepository = new PostgresSourceRepository(pool);
    storyRepository = new PostgresStoryRepository(pool);
    briefingRepository = new PostgresBriefingRepository(pool);

    await accountRepository.ensureUser({
      id: aliceId,
      email: "alice@example.com",
    });
    await accountRepository.ensureUser({
      id: bobId,
      email: "bob@example.com",
    });
    const interest = await accountRepository.createInterest(aliceId, {
      type: "topic",
      name: "Climate science",
      description: "Major Earth observation research and missions.",
      importance: 5,
      expertiseLevel: "intermediate",
      desiredDepth: "standard",
      alertSensitivity: 1,
      preferredSources: [],
      blockedSources: [],
      keywords: [],
      excludedKeywords: [],
    });

    await sourceRepository.registerSource({
      key: "nasa-news",
      name: "NASA News Releases",
      homepageUrl: "https://www.nasa.gov/news-release/",
      feedUrl: "https://www.nasa.gov/news-release/feed/",
      adapterKind: "rss",
      defaultLanguage: "en-US",
      fetchIntervalMinutes: 30,
    });
    const sourceItem: NormalizedSourceItem = {
      sourceKey: "nasa-news",
      externalId: "earth-mission",
      canonicalUrl: "https://www.nasa.gov/news-release/earth-mission/",
      title: "NASA announces a new Earth mission",
      author: "NASA",
      publishedAt: "2026-07-17T14:30:00.000Z",
      discoveredAt: "2026-07-17T15:00:00.000Z",
      language: "en-US",
      excerpt: "The mission will study changes in Earth's atmosphere.",
      contentHash: "c".repeat(64),
      metadata: {},
    };
    await sourceRepository.upsertSourceItems("nasa-news", [sourceItem]);
    const storedSourceItems = await sourceRepository.listSourceItems(
      "nasa-news",
      { limit: 1 },
    );
    const sourceItemId = storedSourceItems[0]?.id;
    if (sourceItemId === undefined) {
      throw new Error("The source-item fixture was not stored.");
    }

    storyDraft = {
      cluster: {
        deduplicationKey: "nasa-earth-mission",
        canonicalTitle: "NASA announces a new Earth mission",
        summary: "NASA announced a mission focused on atmospheric change.",
        firstSeenAt: "2026-07-17T14:30:00.000Z",
        lastUpdatedAt: "2026-07-17T18:00:00.000Z",
        status: "active",
        sourceItems: [
          {
            sourceItemId,
            membershipScore: 1,
            isPrimary: true,
          },
        ],
      },
      claims: [
        {
          key: "mission-purpose",
          kind: "source_fact",
          text: "The mission will study changes in Earth's atmosphere.",
          confidence: 0.98,
          isContested: false,
          citations: [
            {
              sourceItemId,
              supportType: "direct",
              supportingText:
                "The mission will study changes in Earth's atmosphere.",
            },
          ],
        },
      ],
      candidate: {
        key: "default",
        headline: "NASA plans a new atmosphere-monitoring mission",
        takeaway: "The mission will examine changes in Earth's atmosphere.",
        whatChanged: "NASA formally announced the mission today.",
        estimatedSeconds: 45,
        language: "en-US",
        contentClass: "editorial",
        status: "ready",
        baselineScores: {
          globalImportance: 0.7,
          novelty: 0.9,
          urgency: 0.3,
          credibility: 0.98,
          sourceDiversity: 0.4,
          recency: 0.95,
          clickbaitPenalty: 0,
          confidence: 0.96,
        },
        claimKeys: ["mission-purpose"],
        promptVersion: "candidate-v1",
        modelVersion: "fixture-model",
      },
    };
    const story = await storyRepository.saveStoryIntelligence(storyDraft);
    generationRequest = {
      targetMinutes: 1,
      scheduledFor: "2026-07-18T15:00:00.000Z",
      generatedAt: "2026-07-18T14:55:00.000Z",
      overview: "One meaningful science update is ready for you.",
      promptVersion: "briefing-v1",
      modelVersion: "deterministic",
      candidates: [
        {
          story,
          userInterestId: interest.id,
          whyItMatters:
            "You follow climate science and asked for major mission updates.",
          rankingComponents,
        },
      ],
    };
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it("stores one canonical briefing per idempotent request and isolates ownership", async () => {
    const first = await generateAndSaveGroundedBriefing({
      writer: briefingRepository,
      userId: aliceId,
      idempotencyKey: "alice-2026-07-18-daily",
      request: generationRequest,
    });
    const repeated = await generateAndSaveGroundedBriefing({
      writer: briefingRepository,
      userId: aliceId,
      idempotencyKey: "alice-2026-07-18-daily",
      request: generationRequest,
    });

    expect(repeated.id).toBe(first.id);
    expect(first.items[0]?.claims[0]?.citations[0]).toMatchObject({
      publisher: "NASA News Releases",
      canonicalUrl: "https://www.nasa.gov/news-release/earth-mission/",
    });
    await expect(
      briefingRepository.getLatestBriefing(aliceId, "2026-07-18T15:01:00.000Z"),
    ).resolves.toEqual(first);
    await expect(
      briefingRepository.getBriefing(bobId, first.id),
    ).resolves.toBeNull();

    await expect(
      generateAndSaveGroundedBriefing({
        writer: briefingRepository,
        userId: aliceId,
        idempotencyKey: "alice-2026-07-18-daily",
        request: {
          ...generationRequest,
          overview: "A different request reused the same key.",
        },
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);

    const briefingCount = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::INTEGER AS count FROM briefings",
    );
    expect(briefingCount.rows[0]?.count).toBe(1);
  });

  it("records feedback idempotently and preserves the original grounding snapshot", async () => {
    const briefing = await briefingRepository.getLatestBriefing(
      aliceId,
      "2026-07-18T15:01:00.000Z",
    );
    const item = briefing?.items[0];
    if (briefing === null || briefing === undefined || item === undefined) {
      throw new Error("The canonical briefing fixture was not found.");
    }
    const interactionInput = {
      eventType: "useful" as const,
      value: {},
      occurredAt: "2026-07-18T15:02:00.000Z",
      idempotencyKey: "feedback-useful-1",
    };
    const first = await briefingRepository.recordInteraction(
      aliceId,
      briefing.id,
      item.id,
      interactionInput,
    );
    const repeated = await briefingRepository.recordInteraction(
      aliceId,
      briefing.id,
      item.id,
      interactionInput,
    );
    expect(repeated?.id).toBe(first?.id);
    await expect(
      briefingRepository.recordInteraction(
        bobId,
        briefing.id,
        item.id,
        interactionInput,
      ),
    ).resolves.toBeNull();
    await expect(
      briefingRepository.recordInteraction(aliceId, briefing.id, item.id, {
        ...interactionInput,
        eventType: "not_useful",
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);

    const originalClaim = storyDraft.claims[0];
    if (originalClaim === undefined) {
      throw new Error("The reusable claim fixture was not found.");
    }
    storyDraft.claims[0] = {
      ...originalClaim,
      text: "This reusable claim was revised after briefing generation.",
    };
    await storyRepository.saveStoryIntelligence(storyDraft);
    const reloaded = await briefingRepository.getBriefing(aliceId, briefing.id);
    expect(reloaded?.items[0]?.claims[0]?.text).toBe(
      "The mission will study changes in Earth's atmosphere.",
    );
  });
});

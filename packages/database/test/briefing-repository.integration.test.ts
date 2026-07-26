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
  PostgresCalendarRepository,
  PostgresLibraryRepository,
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
  let calendarRepository: PostgresCalendarRepository;
  let generationRequest: GroundedBriefingGenerationRequest;
  let libraryRepository: PostgresLibraryRepository;
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
    calendarRepository = new PostgresCalendarRepository(pool);
    libraryRepository = new PostgresLibraryRepository(pool);

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

  it("lists briefing history and persists independent Saved and Later state", async () => {
    const olderBriefing = await generateAndSaveGroundedBriefing({
      writer: briefingRepository,
      userId: aliceId,
      idempotencyKey: "alice-2026-07-17-daily",
      request: {
        ...generationRequest,
        scheduledFor: "2026-07-17T15:00:00.000Z",
        generatedAt: "2026-07-17T14:55:00.000Z",
        overview: "Yesterday's meaningful science update.",
      },
    });
    const firstHistoryPage = await briefingRepository.listBriefings(aliceId, {
      limit: 1,
    });
    expect(firstHistoryPage).toMatchObject({
      items: [
        {
          itemCount: 1,
          overview: generationRequest.overview,
        },
      ],
    });
    expect(firstHistoryPage.nextCursor).not.toBeNull();
    if (firstHistoryPage.nextCursor === null) {
      throw new Error("Expected a cursor for older briefing history.");
    }
    await expect(
      briefingRepository.listBriefings(aliceId, {
        limit: 1,
        cursor: firstHistoryPage.nextCursor,
      }),
    ).resolves.toMatchObject({
      items: [{ id: olderBriefing.id }],
      nextCursor: null,
    });

    const briefing = await briefingRepository.getLatestBriefing(
      aliceId,
      "2026-07-18T15:01:00.000Z",
    );
    const item = briefing?.items[0];
    if (briefing === null || briefing === undefined || item === undefined) {
      throw new Error("The canonical briefing fixture was not found.");
    }

    await expect(
      libraryRepository.updateItemState(bobId, item.id, { saved: true }),
    ).resolves.toEqual({ found: false, state: null });

    const [savedWrite, deferredWrite] = await Promise.all([
      libraryRepository.updateItemState(aliceId, item.id, {
        saved: true,
      }),
      libraryRepository.updateItemState(aliceId, item.id, {
        deferred: true,
      }),
    ]);
    expect(savedWrite.found).toBe(true);
    expect(deferredWrite.found).toBe(true);
    await expect(
      libraryRepository.listBriefingItemStates(aliceId, briefing.id),
    ).resolves.toMatchObject([
      {
        briefingItemId: item.id,
        savedAt: expect.any(String),
        deferredAt: expect.any(String),
      },
    ]);
    const stored = await libraryRepository.updateItemState(aliceId, item.id, {
      saved: true,
      deferred: true,
    });
    expect(stored).toMatchObject({
      found: true,
      state: {
        briefingItemId: item.id,
        savedAt: expect.any(String),
        deferredAt: expect.any(String),
      },
    });
    await expect(
      libraryRepository.listItems(aliceId, "saved", { limit: 10 }),
    ).resolves.toMatchObject({
      items: [{ item: { id: item.id }, briefing: { id: briefing.id } }],
      nextCursor: null,
    });
    await expect(
      libraryRepository.listItems(aliceId, "deferred", { limit: 10 }),
    ).resolves.toMatchObject({
      items: [{ item: { id: item.id }, briefing: { id: briefing.id } }],
      nextCursor: null,
    });

    const deferredOnly = await libraryRepository.updateItemState(
      aliceId,
      item.id,
      { saved: false },
    );
    expect(deferredOnly).toMatchObject({
      found: true,
      state: {
        savedAt: null,
        deferredAt: expect.any(String),
      },
    });
    await expect(
      libraryRepository.listItems(aliceId, "saved", { limit: 10 }),
    ).resolves.toEqual({ items: [], nextCursor: null });

    await expect(
      libraryRepository.updateItemState(aliceId, item.id, {
        deferred: false,
      }),
    ).resolves.toEqual({ found: true, state: null });
    const persistedCount = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::INTEGER AS count FROM briefing_item_states",
    );
    expect(persistedCount.rows[0]?.count).toBe(0);
  });

  it("stores only free/busy calendar ranges and suggests a usable window", async () => {
    const connection = await calendarRepository.connectDeviceCalendar(aliceId, {
      displayName: "Nathan's iPhone",
    });
    const synchronized = await calendarRepository.syncAvailability(
      aliceId,
      connection.id,
      {
        timezone: "America/Los_Angeles",
        rangeStartsAt: "2026-07-25T17:00:00.000Z",
        rangeEndsAt: "2026-07-25T21:00:00.000Z",
        busyWindows: [
          {
            startsAt: "2026-07-25T17:00:00.000Z",
            endsAt: "2026-07-25T17:30:00.000Z",
          },
          {
            startsAt: "2026-07-25T17:20:00.000Z",
            endsAt: "2026-07-25T17:45:00.000Z",
          },
          {
            startsAt: "2026-07-25T17:53:00.000Z",
            endsAt: "2026-07-25T18:15:00.000Z",
          },
        ],
      },
    );
    expect(synchronized).toMatchObject({
      id: connection.id,
      scope: "free_busy",
      active: true,
      lastSyncedAt: expect.any(String),
    });
    await expect(
      calendarRepository.syncAvailability(bobId, connection.id, {
        timezone: "UTC",
        rangeStartsAt: "2026-07-25T17:00:00.000Z",
        rangeEndsAt: "2026-07-25T18:00:00.000Z",
        busyWindows: [],
      }),
    ).resolves.toBeNull();

    await expect(
      calendarRepository.getAvailability(
        aliceId,
        10,
        "2026-07-25T17:10:00.000Z",
      ),
    ).resolves.toMatchObject({
      connection: { id: connection.id, scope: "free_busy" },
      suggestion: {
        startsAt: "2026-07-25T18:15:00.000Z",
        endsAt: "2026-07-25T21:00:00.000Z",
        availableMinutes: 165,
        suggestedBriefingMinutes: 5,
      },
    });

    const busyWindowCount = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::INTEGER AS count FROM calendar_busy_windows WHERE connection_id = $1",
      [connection.id],
    );
    expect(busyWindowCount.rows[0]?.count).toBe(2);
    const privateColumns = await pool.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE
          table_name = 'calendar_busy_windows'
          AND column_name IN ('title', 'description', 'location', 'attendees')
      `,
    );
    expect(privateColumns.rows).toEqual([]);

    await expect(
      calendarRepository.disconnect(bobId, connection.id),
    ).resolves.toBe(false);
    await expect(
      calendarRepository.disconnect(aliceId, connection.id),
    ).resolves.toBe(true);
    await expect(
      calendarRepository.getAvailability(
        aliceId,
        2,
        "2026-07-25T17:10:00.000Z",
      ),
    ).resolves.toEqual({
      connection: null,
      suggestion: null,
      rangeStartsAt: null,
      rangeEndsAt: null,
    });
  });
});

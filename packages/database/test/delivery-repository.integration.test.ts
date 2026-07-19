import {
  createDatabasePool,
  PostgresAccountRepository,
  PostgresDeliveryRepository,
  runMigrations,
} from "@tempo/database";
import { ConfiguredDeliveryScheduler } from "../../delivery/src/index.js";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  FIXTURE_IDS,
  fixtureCanonicalBriefing,
} from "../../../test/fixtures/briefing.js";
import {
  startTestPostgres,
  type TestPostgres,
} from "../../../test/support/postgres.js";

const bobId = "00000000-0000-4000-8000-000000000701";

describe("delivery repository", () => {
  let postgres: TestPostgres;
  let pool: Pool;
  let repository: PostgresDeliveryRepository;

  beforeAll(async () => {
    postgres = await startTestPostgres();
    pool = createDatabasePool({
      connectionString: postgres.connectionString,
      maxConnections: 4,
    });
    await runMigrations(pool);
    const accounts = new PostgresAccountRepository(pool);
    await accounts.ensureUser({
      id: FIXTURE_IDS.userId,
      email: "Reader@Example.com",
    });
    await accounts.completeOnboarding(FIXTURE_IDS.userId, {
      preferences: {
        timezone: "UTC",
        locale: "en-US",
        defaultBriefingMinutes: 5,
        dailyBriefingTime: "08:00",
        quietHoursStart: null,
        quietHoursEnd: null,
        deliveryChannels: ["in_app", "push", "email"],
        calendarSuggestionsEnabled: false,
        recommendationsEnabled: false,
      },
      interests: [
        {
          type: "topic",
          name: "Climate science",
          description: "Major climate research",
          importance: 5,
          expertiseLevel: "intermediate",
          desiredDepth: "standard",
          alertSensitivity: 1,
          preferredSources: [],
          blockedSources: [],
          keywords: ["climate"],
          excludedKeywords: [],
        },
      ],
    });
    await accounts.ensureUser({
      id: bobId,
      email: "bob@example.com",
    });
    const briefing = fixtureCanonicalBriefing();
    await pool.query(
      `
        INSERT INTO briefings (
          id,
          user_id,
          target_minutes,
          actual_word_count,
          estimated_seconds,
          scheduled_for,
          generated_at,
          status,
          overview,
          prompt_version,
          model_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        briefing.id,
        briefing.userId,
        briefing.targetMinutes,
        briefing.actualWordCount,
        briefing.estimatedSeconds,
        briefing.scheduledFor,
        briefing.generatedAt,
        briefing.status,
        briefing.overview,
        briefing.promptVersion,
        briefing.modelVersion,
      ],
    );
    repository = new PostgresDeliveryRepository(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it("stores endpoints and schedules canonical renderings idempotently", async () => {
    const endpoint = await repository.upsertEndpoint(FIXTURE_IDS.userId, {
      channel: "push",
      destination: "ExpoPushToken[fixture-token]",
      enabled: true,
    });
    const repeatedEndpoint = await repository.upsertEndpoint(
      FIXTURE_IDS.userId,
      {
        channel: "push",
        destination: "ExpoPushToken[fixture-token]",
        enabled: true,
      },
    );
    expect(repeatedEndpoint.id).toBe(endpoint.id);
    const emailEndpoint = await repository.upsertEndpoint(
      FIXTURE_IDS.userId,
      {
        channel: "email",
        destination: "reader@example.com",
        enabled: true,
      },
      "reader@example.com",
    );
    expect(emailEndpoint.verificationStatus).toBe("verified");
    const smsEndpoint = await repository.upsertEndpoint(FIXTURE_IDS.userId, {
      channel: "sms",
      destination: "+14155550123",
      enabled: true,
    });
    expect(smsEndpoint.verificationStatus).toBe("pending");
    await repository.requestEndpointVerification(
      FIXTURE_IDS.userId,
      smsEndpoint.id,
      "b".repeat(64),
      "2026-07-18T15:10:00.000Z",
    );
    await expect(
      repository.verifyEndpoint(
        FIXTURE_IDS.userId,
        smsEndpoint.id,
        "b".repeat(64),
        "2026-07-18T15:01:00.000Z",
      ),
    ).resolves.toMatchObject({
      status: "verified",
      endpoint: { id: smsEndpoint.id, verificationStatus: "verified" },
    });
    await expect(repository.listEndpoints(bobId)).resolves.toEqual([]);

    const scheduler = new ConfiguredDeliveryScheduler({
      repository,
      briefingBaseUrl: "https://tempo.example",
    });
    const first = await scheduler.scheduleForBriefing(
      FIXTURE_IDS.userId,
      fixtureCanonicalBriefing(),
    );
    const retry = await scheduler.scheduleForBriefing(
      FIXTURE_IDS.userId,
      fixtureCanonicalBriefing(),
    );

    expect(first).toHaveLength(2);
    expect(retry.map(({ id }) => id).sort()).toEqual(
      first.map(({ id }) => id).sort(),
    );
    expect(first.map(({ channel }) => channel).sort()).toEqual([
      "email",
      "push",
    ]);
    await expect(repository.listDeliveries(bobId, 20)).resolves.toEqual([]);
    const count = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::INTEGER AS count FROM deliveries",
    );
    expect(count.rows[0]?.count).toBe(2);
  });

  it("claims with leases and records sent and retryable outcomes", async () => {
    const claimed = await repository.claimDueDeliveries({
      workerId: "delivery-worker-a",
      now: "2026-07-18T15:00:01.000Z",
      leaseUntil: "2026-07-18T15:05:01.000Z",
      limit: 10,
    });
    expect(claimed).toHaveLength(2);
    await expect(
      repository.claimDueDeliveries({
        workerId: "delivery-worker-b",
        now: "2026-07-18T15:00:02.000Z",
        leaseUntil: "2026-07-18T15:05:02.000Z",
        limit: 10,
      }),
    ).resolves.toEqual([]);

    const push = claimed.find(({ channel }) => channel === "push");
    const email = claimed.find(({ channel }) => channel === "email");
    if (push === undefined || email === undefined) {
      throw new Error("Expected push and email delivery fixtures.");
    }
    await repository.markDeliverySent({
      deliveryId: push.id,
      workerId: "delivery-worker-a",
      providerMessageId: "expo-receipt-1",
      sentAt: "2026-07-18T15:00:03.000Z",
    });
    await repository.markDeliveryFailed({
      deliveryId: email.id,
      workerId: "delivery-worker-a",
      error: "Temporary provider outage",
      failedAt: "2026-07-18T15:00:03.000Z",
      nextAttemptAt: "2026-07-18T15:03:03.000Z",
    });
    await expect(
      repository.claimDueDeliveries({
        workerId: "delivery-worker-b",
        now: "2026-07-18T15:03:02.000Z",
        leaseUntil: "2026-07-18T15:08:02.000Z",
        limit: 10,
      }),
    ).resolves.toEqual([]);

    const retried = await repository.claimDueDeliveries({
      workerId: "delivery-worker-b",
      now: "2026-07-18T15:03:03.000Z",
      leaseUntil: "2026-07-18T15:08:03.000Z",
      limit: 10,
    });
    expect(retried).toHaveLength(1);
    expect(retried[0]).toMatchObject({
      id: email.id,
      attemptCount: 2,
      workerId: "delivery-worker-b",
    });

    const receipts = await repository.claimPushReceipts({
      workerId: "receipt-worker",
      now: "2026-07-18T15:00:33.000Z",
      leaseUntil: "2026-07-18T15:05:33.000Z",
      limit: 10,
    });
    expect(receipts).toHaveLength(1);
    const receipt = receipts[0];
    if (receipt === undefined) {
      throw new Error("Expected a claimed Expo receipt.");
    }
    await repository.markPushReceiptFailed(
      receipt.deliveryId,
      "receipt-worker",
      "DeviceNotRegistered",
      "2026-07-18T15:00:34.000Z",
      null,
      true,
    );
    const pushEndpoint = (
      await repository.listEndpoints(FIXTURE_IDS.userId)
    ).find(({ channel }) => channel === "push");
    expect(pushEndpoint?.enabled).toBe(false);
  });
});

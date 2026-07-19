import {
  createDatabasePool,
  PostgresAccountRepository,
  PostgresScheduledBriefingRunRepository,
  runMigrations,
} from "@tempo/database";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  startTestPostgres,
  type TestPostgres,
} from "../../../test/support/postgres.js";

const userId = "00000000-0000-4000-8000-000000000301";

describe("scheduled briefing run repository", () => {
  let postgres: TestPostgres;
  let pool: Pool;
  let repository: PostgresScheduledBriefingRunRepository;

  beforeAll(async () => {
    postgres = await startTestPostgres();
    pool = createDatabasePool({
      connectionString: postgres.connectionString,
      maxConnections: 4,
    });
    await runMigrations(pool);
    const accounts = new PostgresAccountRepository(pool);
    await accounts.ensureUser({
      id: userId,
      email: "scheduled@example.com",
    });
    await accounts.completeOnboarding(userId, {
      preferences: {
        timezone: "America/Los_Angeles",
        locale: "en-US",
        defaultBriefingMinutes: 5,
        dailyBriefingTime: "08:00",
        quietHoursStart: null,
        quietHoursEnd: null,
        deliveryChannels: ["in_app"],
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
    repository = new PostgresScheduledBriefingRunRepository(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it("claims once per local day with leases and scheduled retry timing", async () => {
    await expect(
      repository.claimDueRuns({
        workerId: "worker-before",
        now: "2026-07-18T14:59:59.000Z",
        leaseUntil: "2026-07-18T15:09:59.000Z",
        limit: 10,
      }),
    ).resolves.toEqual([]);

    const first = await repository.claimDueRuns({
      workerId: "worker-a",
      now: "2026-07-18T15:00:00.000Z",
      leaseUntil: "2026-07-18T15:10:00.000Z",
      limit: 10,
    });
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      userId,
      localDate: "2026-07-18",
      scheduledFor: "2026-07-18T15:00:00.000Z",
      attemptCount: 1,
      status: "processing",
    });

    await expect(
      repository.claimDueRuns({
        workerId: "worker-b",
        now: "2026-07-18T15:00:01.000Z",
        leaseUntil: "2026-07-18T15:10:01.000Z",
        limit: 10,
      }),
    ).resolves.toEqual([]);

    const run = first[0];
    if (run === undefined) {
      throw new Error("Expected the claimed generation run.");
    }
    await repository.failRun({
      runId: run.id,
      workerId: "worker-a",
      candidateCount: 2,
      error: "Temporary generation failure",
      failedAt: "2026-07-18T15:00:02.000Z",
      nextAttemptAt: "2026-07-18T15:05:02.000Z",
    });
    await expect(
      repository.claimDueRuns({
        workerId: "worker-b",
        now: "2026-07-18T15:05:01.000Z",
        leaseUntil: "2026-07-18T15:15:01.000Z",
        limit: 10,
      }),
    ).resolves.toEqual([]);

    const retried = await repository.claimDueRuns({
      workerId: "worker-b",
      now: "2026-07-18T15:05:02.000Z",
      leaseUntil: "2026-07-18T15:15:02.000Z",
      limit: 10,
    });
    expect(retried[0]).toMatchObject({
      id: run.id,
      attemptCount: 2,
      workerId: "worker-b",
    });
    await repository.skipRun({
      runId: run.id,
      workerId: "worker-b",
      candidateCount: 2,
      reason: "No candidate fit the duration.",
      completedAt: "2026-07-18T15:05:03.000Z",
    });

    await expect(
      repository.claimDueRuns({
        workerId: "worker-c",
        now: "2026-07-18T20:00:00.000Z",
        leaseUntil: "2026-07-18T20:10:00.000Z",
        limit: 10,
      }),
    ).resolves.toEqual([]);
    const nextDay = await repository.claimDueRuns({
      workerId: "worker-c",
      now: "2026-07-19T15:00:00.000Z",
      leaseUntil: "2026-07-19T15:10:00.000Z",
      limit: 10,
    });
    expect(nextDay[0]).toMatchObject({
      localDate: "2026-07-19",
      attemptCount: 1,
    });
  });
});

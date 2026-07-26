import {
  createDatabasePool,
  PostgresAccountRepository,
  PostgresBriefingRepository,
  PostgresCalendarRepository,
  PostgresDeliveryRepository,
  PostgresLibraryRepository,
  runMigrations,
} from "@tempo/database";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AuthenticationError,
  type AccessTokenVerifier,
  type AuthPrincipal,
} from "../src/auth.js";
import { buildApp } from "../src/app.js";
import {
  startTestPostgres,
  type TestPostgres,
} from "../../../test/support/postgres.js";

const alice: AuthPrincipal = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "alice@example.com",
};
const bob: AuthPrincipal = {
  userId: "00000000-0000-4000-8000-000000000002",
  email: "bob@example.com",
};

class TestAccessTokenVerifier implements AccessTokenVerifier {
  public verify(accessToken: string): Promise<AuthPrincipal> {
    if (accessToken === "alice-token") {
      return Promise.resolve(alice);
    }
    if (accessToken === "bob-token") {
      return Promise.resolve(bob);
    }
    return Promise.reject(new AuthenticationError("Unknown test token."));
  }
}

describe("account persistence and authorization", () => {
  let postgres: TestPostgres;
  let pool: Pool;
  let app: ReturnType<typeof buildApp> | undefined;
  const sentCodes = new Map<string, string>();

  beforeAll(async () => {
    postgres = await startTestPostgres();
    pool = createDatabasePool({
      connectionString: postgres.connectionString,
      maxConnections: 4,
    });
    const firstMigration = await runMigrations(pool);
    const secondMigration = await runMigrations(pool);
    expect(firstMigration.applied).toEqual([
      "0001_users_preferences_interests.sql",
      "0002_sources_and_source_items.sql",
      "0003_source_fetch_scheduling.sql",
      "0004_story_intelligence.sql",
      "0005_canonical_briefings.sql",
      "0006_mobile_onboarding.sql",
      "0007_scheduled_briefing_generation.sql",
      "0008_canonical_deliveries.sql",
      "0009_delivery_safety_and_push_receipts.sql",
      "0010_story_intelligence_jobs.sql",
      "0011_closed_beta_core.sql",
    ]);
    expect(secondMigration.applied).toEqual([]);

    app = buildApp({
      accountRepository: new PostgresAccountRepository(pool),
      briefingRepository: new PostgresBriefingRepository(pool),
      calendarRepository: new PostgresCalendarRepository(pool),
      deliveryRepository: new PostgresDeliveryRepository(pool),
      libraryRepository: new PostgresLibraryRepository(pool),
      accessTokenVerifier: new TestAccessTokenVerifier(),
      deliveryVerificationSecret:
        "test-verification-secret-at-least-32-characters",
      verificationSender: {
        sendCode: (endpoint, code) => {
          sentCodes.set(endpoint.id, code);
          return Promise.resolve();
        },
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    await postgres?.stop();
  });

  it("persists explicit user preferences", async () => {
    const profileResponse = await app?.inject({
      method: "GET",
      url: "/v1/users/me",
      headers: {
        authorization: "Bearer alice-token",
      },
    });
    expect(profileResponse?.statusCode).toBe(200);
    expect(profileResponse?.json()).toMatchObject({
      user: {
        id: alice.userId,
        email: alice.email,
      },
      preferences: {
        defaultBriefingMinutes: 5,
        recommendationsEnabled: false,
      },
    });

    const updateResponse = await app?.inject({
      method: "PUT",
      url: "/v1/preferences",
      headers: {
        authorization: "Bearer alice-token",
      },
      payload: {
        timezone: "America/Chicago",
        locale: "en-US",
        defaultBriefingMinutes: 10,
        dailyBriefingTime: "07:30",
        quietHoursStart: "22:30",
        quietHoursEnd: "06:30",
        deliveryChannels: ["in_app", "email"],
        calendarSuggestionsEnabled: true,
        recommendationsEnabled: false,
      },
    });
    expect(updateResponse?.statusCode).toBe(200);
    expect(updateResponse?.json()).toMatchObject({
      timezone: "America/Chicago",
      defaultBriefingMinutes: 10,
      dailyBriefingTime: "07:30",
    });
  });

  it("isolates interests by the verified token subject", async () => {
    const createResponse = await app?.inject({
      method: "POST",
      url: "/v1/interests",
      headers: {
        authorization: "Bearer alice-token",
      },
      payload: {
        type: "topic",
        name: "Climate science",
        description: "Major research and policy changes",
        importance: 5,
        expertiseLevel: "intermediate",
        desiredDepth: "standard",
        alertSensitivity: 2,
        keywords: ["climate"],
      },
    });
    expect(createResponse?.statusCode).toBe(201);
    const aliceInterest = createResponse?.json<{
      id: string;
      name: string;
    }>();
    expect(aliceInterest?.name).toBe("Climate science");
    if (aliceInterest === undefined) {
      throw new Error("Expected the created interest response.");
    }

    const secondCreateResponse = await app?.inject({
      method: "POST",
      url: "/v1/interests",
      headers: {
        authorization: "Bearer alice-token",
      },
      payload: {
        type: "instruction",
        name: "Japanese cooking",
        description: "Seasonal techniques without restaurant promotion",
        importance: 3,
        expertiseLevel: "beginner",
        desiredDepth: "brief",
        alertSensitivity: 0,
        excludedKeywords: ["sponsored"],
      },
    });
    expect(secondCreateResponse?.statusCode).toBe(201);

    const aliceList = await app?.inject({
      method: "GET",
      url: "/v1/interests?limit=1",
      headers: {
        authorization: "Bearer alice-token",
      },
    });
    expect(aliceList?.statusCode).toBe(200);
    const firstPage = aliceList?.json<{
      items: unknown[];
      nextCursor: string | null;
    }>();
    expect(firstPage?.items).toHaveLength(1);
    expect(firstPage?.nextCursor).not.toBeNull();
    if (firstPage?.nextCursor === null || firstPage?.nextCursor === undefined) {
      throw new Error("Expected a cursor for the second interest page.");
    }

    const aliceSecondPage = await app?.inject({
      method: "GET",
      url: `/v1/interests?limit=1&cursor=${firstPage.nextCursor}`,
      headers: {
        authorization: "Bearer alice-token",
      },
    });
    expect(aliceSecondPage?.statusCode).toBe(200);
    expect(aliceSecondPage?.json()).toMatchObject({
      items: [{}],
      nextCursor: null,
    });

    const bobList = await app?.inject({
      method: "GET",
      url: "/v1/interests?limit=10",
      headers: {
        authorization: "Bearer bob-token",
      },
    });
    expect(bobList?.statusCode).toBe(200);
    expect(bobList?.json()).toEqual({
      items: [],
      nextCursor: null,
    });

    const forbiddenUpdate = await app?.inject({
      method: "PATCH",
      url: `/v1/interests/${aliceInterest.id}`,
      headers: {
        authorization: "Bearer bob-token",
      },
      payload: {
        importance: 1,
      },
    });
    expect(forbiddenUpdate?.statusCode).toBe(404);

    const ownerUpdate = await app?.inject({
      method: "PATCH",
      url: `/v1/interests/${aliceInterest.id}`,
      headers: {
        authorization: "Bearer alice-token",
      },
      payload: {
        name: "Climate science and policy",
        description: "Material research, missions, and policy changes",
        desiredDepth: "deep",
        active: false,
      },
    });
    expect(ownerUpdate?.statusCode).toBe(200);
    expect(ownerUpdate?.json()).toMatchObject({
      id: aliceInterest.id,
      name: "Climate science and policy",
      desiredDepth: "deep",
      active: false,
    });

    const activeList = await app?.inject({
      method: "GET",
      url: "/v1/interests?limit=10&active=true",
      headers: {
        authorization: "Bearer alice-token",
      },
    });
    expect(activeList?.json()).not.toMatchObject({
      items: [{ id: aliceInterest.id }],
    });

    const reactivated = await app?.inject({
      method: "PATCH",
      url: `/v1/interests/${aliceInterest.id}`,
      headers: {
        authorization: "Bearer alice-token",
      },
      payload: {
        active: true,
      },
    });
    expect(reactivated?.statusCode).toBe(200);
    expect(reactivated?.json()).toMatchObject({
      id: aliceInterest.id,
      active: true,
    });

    const forbiddenDelete = await app?.inject({
      method: "DELETE",
      url: `/v1/interests/${aliceInterest.id}`,
      headers: {
        authorization: "Bearer bob-token",
      },
    });
    expect(forbiddenDelete?.statusCode).toBe(404);

    const ownerDelete = await app?.inject({
      method: "DELETE",
      url: `/v1/interests/${aliceInterest.id}`,
      headers: {
        authorization: "Bearer alice-token",
      },
    });
    expect(ownerDelete?.statusCode).toBe(204);

    const afterDelete = await app?.inject({
      method: "GET",
      url: "/v1/interests?limit=10",
      headers: {
        authorization: "Bearer alice-token",
      },
    });
    expect(afterDelete?.json()).not.toMatchObject({
      items: [{ id: aliceInterest.id }],
    });
    const retainedHistory = await pool.query<{ deleted_at: Date | null }>(
      "SELECT deleted_at FROM user_interests WHERE id = $1 AND user_id = $2",
      [aliceInterest.id, alice.userId],
    );
    expect(retainedHistory.rows[0]?.deleted_at).toBeInstanceOf(Date);
  });

  it("completes onboarding atomically and idempotently", async () => {
    await app?.inject({
      method: "GET",
      url: "/v1/users/me",
      headers: {
        authorization: "Bearer bob-token",
      },
    });
    const payload = {
      preferences: {
        timezone: "America/Los_Angeles",
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
          description: "Meaningful research and policy changes",
          importance: 5,
          expertiseLevel: "intermediate",
          desiredDepth: "standard",
          alertSensitivity: 1,
          keywords: ["climate"],
        },
      ],
    };

    const first = await app?.inject({
      method: "POST",
      url: "/v1/onboarding",
      headers: {
        authorization: "Bearer bob-token",
      },
      payload,
    });
    const retry = await app?.inject({
      method: "POST",
      url: "/v1/onboarding",
      headers: {
        authorization: "Bearer bob-token",
      },
      payload,
    });
    const conflict = await app?.inject({
      method: "POST",
      url: "/v1/onboarding",
      headers: {
        authorization: "Bearer bob-token",
      },
      payload: {
        ...payload,
        preferences: {
          ...payload.preferences,
          defaultBriefingMinutes: 10,
        },
      },
    });

    expect(first?.statusCode).toBe(200);
    expect(first?.json()).toMatchObject({
      profile: {
        user: {
          id: bob.userId,
          onboardingCompletedAt: expect.any(String),
        },
        preferences: {
          deliveryChannels: ["in_app", "push", "email"],
        },
      },
      interests: [{ name: "Climate science" }],
    });
    expect(retry?.statusCode).toBe(200);
    expect(retry?.json()).toEqual(first?.json());
    expect(conflict?.statusCode).toBe(409);
    expect(conflict?.json()).toMatchObject({
      error: {
        code: "IDEMPOTENCY_CONFLICT",
      },
    });
  });

  it("keeps delivery endpoints under the verified owner", async () => {
    const created = await app?.inject({
      method: "PUT",
      url: "/v1/delivery-endpoints",
      headers: {
        authorization: "Bearer bob-token",
      },
      payload: {
        channel: "push",
        destination: "ExpoPushToken[bob-device]",
        enabled: true,
      },
    });
    expect(created?.statusCode).toBe(200);
    const endpoint = created?.json<{ id: string }>();
    if (endpoint === undefined) {
      throw new Error("Expected a delivery endpoint.");
    }

    const bobList = await app?.inject({
      method: "GET",
      url: "/v1/delivery-endpoints",
      headers: {
        authorization: "Bearer bob-token",
      },
    });
    const aliceDisable = await app?.inject({
      method: "DELETE",
      url: `/v1/delivery-endpoints/${endpoint.id}`,
      headers: {
        authorization: "Bearer alice-token",
      },
    });
    const bobDisable = await app?.inject({
      method: "DELETE",
      url: `/v1/delivery-endpoints/${endpoint.id}`,
      headers: {
        authorization: "Bearer bob-token",
      },
    });

    expect(bobList?.json()).toMatchObject({
      items: [{ id: endpoint.id, enabled: true }],
    });
    expect(aliceDisable?.statusCode).toBe(404);
    expect(bobDisable?.statusCode).toBe(204);
  });

  it("verifies an owned SMS destination before it can be scheduled", async () => {
    const created = await app?.inject({
      method: "PUT",
      url: "/v1/delivery-endpoints",
      headers: { authorization: "Bearer bob-token" },
      payload: {
        channel: "sms",
        destination: "+14155550123",
        enabled: true,
      },
    });
    expect(created?.statusCode).toBe(200);
    const endpoint = created?.json<{
      id: string;
      verificationStatus: string;
    }>();
    expect(endpoint?.verificationStatus).toBe("pending");
    if (endpoint === undefined) throw new Error("Expected an SMS endpoint.");

    const requested = await app?.inject({
      method: "POST",
      url: `/v1/delivery-endpoints/${endpoint.id}/verification`,
      headers: { authorization: "Bearer bob-token" },
    });
    expect(requested?.statusCode).toBe(202);
    const code = sentCodes.get(endpoint.id);
    if (code === undefined) throw new Error("Expected a verification code.");

    const crossUser = await app?.inject({
      method: "POST",
      url: `/v1/delivery-endpoints/${endpoint.id}/verification/confirm`,
      headers: { authorization: "Bearer alice-token" },
      payload: { code },
    });
    expect(crossUser?.statusCode).toBe(404);

    const confirmed = await app?.inject({
      method: "POST",
      url: `/v1/delivery-endpoints/${endpoint.id}/verification/confirm`,
      headers: { authorization: "Bearer bob-token" },
      payload: { code },
    });
    expect(confirmed?.statusCode).toBe(200);
    expect(confirmed?.json()).toMatchObject({
      id: endpoint.id,
      verificationStatus: "verified",
      verifiedAt: expect.any(String),
    });
  });
});

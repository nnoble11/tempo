import type {
  BriefingInteraction,
  CanonicalBriefing,
  CompleteOnboardingResult,
  Delivery,
  DeliveryEndpoint,
  InterestPage,
  UserInterest,
  UserPreferences,
  UserProfile,
} from "@tempo/contracts";
import type {
  AccountRepository,
  BriefingRepository,
  DeliveryConfiguration,
  DeliveryRepository,
} from "@tempo/database";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type { AccessTokenVerifier, AuthPrincipal } from "../src/auth.js";
import { createUnusedDependencies } from "./test-dependencies.js";

const aliceId = "00000000-0000-4000-8000-000000000001";
const bobId = "00000000-0000-4000-8000-000000000002";
const briefingId = "00000000-0000-4000-8000-000000000003";
const briefingItemId = "00000000-0000-4000-8000-000000000004";

const profile = (userId: string): UserProfile => ({
  user: {
    id: userId,
    email: `${userId === aliceId ? "alice" : "bob"}@example.com`,
    onboardingCompletedAt: "2026-07-18T14:00:00.000Z",
    createdAt: "2026-07-18T14:00:00.000Z",
    updatedAt: "2026-07-18T14:00:00.000Z",
  },
  preferences: {
    userId,
    timezone: "UTC",
    locale: "en-US",
    defaultBriefingMinutes: 5,
    dailyBriefingTime: "08:00",
    quietHoursStart: null,
    quietHoursEnd: null,
    deliveryChannels: ["in_app"],
    calendarSuggestionsEnabled: false,
    recommendationsEnabled: false,
    createdAt: "2026-07-18T14:00:00.000Z",
    updatedAt: "2026-07-18T14:00:00.000Z",
  },
});

const briefing: CanonicalBriefing = {
  id: briefingId,
  userId: aliceId,
  targetMinutes: 5,
  actualWordCount: 38,
  estimatedSeconds: 45,
  scheduledFor: "2026-07-18T15:00:00.000Z",
  generatedAt: "2026-07-18T14:55:00.000Z",
  status: "ready",
  overview: "One meaningful science update is ready for you.",
  promptVersion: "briefing-v1",
  modelVersion: "deterministic",
  items: [
    {
      id: briefingItemId,
      briefingId,
      storyClusterId: "00000000-0000-4000-8000-000000000005",
      candidateUpdateId: "00000000-0000-4000-8000-000000000006",
      userInterestId: "00000000-0000-4000-8000-000000000007",
      position: 1,
      headline: "NASA plans a new atmosphere-monitoring mission",
      takeaway: "The mission will examine changes in Earth's atmosphere.",
      whyItMatters: "You follow major climate-science missions.",
      whatChanged: "NASA formally announced the mission today.",
      estimatedSeconds: 45,
      ranking: {
        components: {
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
        },
        baseScore: 0.724,
        bonusScore: 0.31,
        penaltyScore: 0,
        finalScore: 1,
      },
      claims: [
        {
          claimId: "00000000-0000-4000-8000-000000000008",
          key: "mission-purpose",
          kind: "source_fact",
          text: "The mission will study atmospheric change.",
          confidence: 0.98,
          isContested: false,
          citations: [
            {
              citationId: "00000000-0000-4000-8000-000000000009",
              sourceItemId: "00000000-0000-4000-8000-000000000010",
              canonicalUrl: "https://www.nasa.gov/news-release/earth-mission/",
              sourceTitle: "NASA announces a new Earth mission",
              publisher: "NASA News Releases",
              publishedAt: "2026-07-17T14:30:00.000Z",
              supportType: "direct",
              supportingText: "The mission will study atmospheric change.",
            },
          ],
        },
      ],
      createdAt: "2026-07-18T14:55:00.000Z",
    },
  ],
  createdAt: "2026-07-18T14:55:00.000Z",
  updatedAt: "2026-07-18T14:55:00.000Z",
};

class TestAccountRepository implements AccountRepository {
  public ensureUser(identity: { id: string }): Promise<UserProfile> {
    return Promise.resolve(profile(identity.id));
  }

  public getPreferences(): Promise<UserPreferences | null> {
    return Promise.reject(new Error("Unused test method."));
  }

  public updatePreferences(): Promise<UserPreferences> {
    return Promise.reject(new Error("Unused test method."));
  }

  public createInterest(): Promise<UserInterest> {
    return Promise.reject(new Error("Unused test method."));
  }

  public listInterests(): Promise<InterestPage> {
    return Promise.reject(new Error("Unused test method."));
  }

  public updateInterest(): Promise<UserInterest | null> {
    return Promise.reject(new Error("Unused test method."));
  }

  public deleteInterest(): Promise<boolean> {
    return Promise.reject(new Error("Unused test method."));
  }

  public completeOnboarding(): Promise<CompleteOnboardingResult> {
    return Promise.reject(new Error("Unused test method."));
  }
}

class TestBriefingRepository implements BriefingRepository {
  public saveCanonicalBriefing(): Promise<CanonicalBriefing> {
    return Promise.reject(new Error("Unused test method."));
  }

  public getBriefing(userId: string): Promise<CanonicalBriefing | null> {
    return Promise.resolve(userId === aliceId ? briefing : null);
  }

  public getLatestBriefing(userId: string): Promise<CanonicalBriefing | null> {
    return Promise.resolve(userId === aliceId ? briefing : null);
  }

  public getBriefingByGenerationKey(): Promise<CanonicalBriefing | null> {
    return Promise.reject(new Error("Unused test method."));
  }

  public listBriefings() {
    return Promise.resolve({
      items: [
        {
          id: briefing.id,
          scheduledFor: briefing.scheduledFor,
          generatedAt: briefing.generatedAt,
          status: briefing.status,
          overview: briefing.overview,
          targetMinutes: briefing.targetMinutes,
          estimatedSeconds: briefing.estimatedSeconds,
          itemCount: briefing.items.length,
        },
      ],
      nextCursor: null,
    });
  }

  public recordInteraction(
    userId: string,
  ): Promise<BriefingInteraction | null> {
    if (userId !== aliceId) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      id: "00000000-0000-4000-8000-000000000011",
      userId,
      briefingItemId,
      eventType: "useful",
      value: {},
      occurredAt: "2026-07-18T15:02:00.000Z",
      idempotencyKey: "mobile-useful-1",
      createdAt: "2026-07-18T15:02:00.000Z",
    });
  }
}

class TestDeliveryRepository implements DeliveryRepository {
  public upsertEndpoint(): Promise<DeliveryEndpoint> {
    return Promise.reject(new Error("Unused test method."));
  }

  public listEndpoints(): Promise<DeliveryEndpoint[]> {
    return Promise.resolve([]);
  }

  public disableEndpoint(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public getConfiguration(): Promise<DeliveryConfiguration> {
    return Promise.reject(new Error("Unused test method."));
  }

  public saveDelivery(): Promise<Delivery> {
    return Promise.reject(new Error("Unused test method."));
  }

  public listDeliveries(): Promise<Delivery[]> {
    return Promise.resolve([]);
  }

  public claimDueDeliveries(): Promise<Delivery[]> {
    return Promise.reject(new Error("Unused test method."));
  }

  public markDeliverySent(): Promise<void> {
    return Promise.reject(new Error("Unused test method."));
  }

  public markDeliveryFailed(): Promise<void> {
    return Promise.reject(new Error("Unused test method."));
  }
}

class TestAccessTokenVerifier implements AccessTokenVerifier {
  public verify(accessToken: string): Promise<AuthPrincipal> {
    const userId = accessToken === "alice-token" ? aliceId : bobId;
    return Promise.resolve({
      userId,
      email: userId === aliceId ? "alice@example.com" : "bob@example.com",
    });
  }
}

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

const createApp = () => {
  const app = buildApp({
    ...createUnusedDependencies(),
    accountRepository: new TestAccountRepository(),
    briefingRepository: new TestBriefingRepository(),
    deliveryRepository: new TestDeliveryRepository(),
    accessTokenVerifier: new TestAccessTokenVerifier(),
  });
  apps.push(app);
  return app;
};

describe("canonical briefing routes", () => {
  it("returns the authenticated user's Today briefing", async () => {
    const response = await createApp().inject({
      method: "GET",
      url: "/v1/briefings/today",
      headers: {
        authorization: "Bearer alice-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      briefing: {
        id: briefingId,
        items: [{ id: briefingItemId }],
      },
    });
  });

  it("returns paginated briefing history", async () => {
    const response = await createApp().inject({
      method: "GET",
      url: "/v1/briefings?limit=10",
      headers: {
        authorization: "Bearer alice-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [{ id: briefingId, itemCount: 1 }],
      nextCursor: null,
    });
  });

  it("does not expose a briefing or item owned by another user", async () => {
    const app = createApp();
    const briefingResponse = await app.inject({
      method: "GET",
      url: `/v1/briefings/${briefingId}`,
      headers: {
        authorization: "Bearer bob-token",
      },
    });
    const interactionResponse = await app.inject({
      method: "POST",
      url: `/v1/briefings/${briefingId}/items/${briefingItemId}/interactions`,
      headers: {
        authorization: "Bearer bob-token",
      },
      payload: {
        eventType: "useful",
        value: {},
        occurredAt: "2026-07-18T15:02:00.000Z",
        idempotencyKey: "mobile-useful-1",
      },
    });

    expect(briefingResponse.statusCode).toBe(404);
    expect(interactionResponse.statusCode).toBe(404);
  });
});

import { createHash, randomUUID } from "node:crypto";

import type { UserPreferencesInput } from "@tempo/contracts";
import {
  createDatabasePool,
  PostgresAccountRepository,
  PostgresBriefingRepository,
  PostgresIntelligenceJobRepository,
  PostgresScheduledBriefingRunRepository,
  PostgresSourceRepository,
  PostgresStoryRepository,
  runMigrations,
} from "@tempo/database";
import { runGenerationCycle } from "@tempo/generation";
import {
  DeterministicIntelligenceProcessor,
  runIntelligenceCycle,
} from "@tempo/intelligence";

import { ensureTestAuthUser } from "./auth-user.js";
import { TestEnvironmentSchema } from "./config.js";

const environment = TestEnvironmentSchema.parse(process.env);
const pool = createDatabasePool({
  connectionString: environment.DATABASE_URL,
  useSsl: environment.DATABASE_SSL === "true",
});

try {
  await runMigrations(pool);
  const userId = await ensureTestAuthUser(environment);
  const accounts = new PostgresAccountRepository(pool);
  const profile = await accounts.ensureUser({
    id: userId,
    email: environment.TEST_USER_EMAIL,
  });
  const setupTime = new Date();
  const preferences: UserPreferencesInput = {
    timezone: "UTC",
    locale: "en-US",
    defaultBriefingMinutes: 5,
    dailyBriefingTime: "00:00",
    quietHoursStart: null,
    quietHoursEnd: null,
    deliveryChannels: ["in_app"],
    calendarSuggestionsEnabled: false,
    recommendationsEnabled: false,
  };
  if (profile.user.onboardingCompletedAt === null) {
    await accounts.completeOnboarding(userId, {
      preferences,
      interests: [
        {
          type: "topic",
          name: "Climate science",
          description: "Major climate research and Earth observations",
          importance: 5,
          expertiseLevel: "intermediate",
          desiredDepth: "standard",
          alertSensitivity: 1,
          preferredSources: [],
          blockedSources: [],
          keywords: ["climate", "earth", "mission"],
          excludedKeywords: [],
        },
      ],
    });
  } else {
    await accounts.updatePreferences(userId, preferences);
    const interests = await accounts.listInterests(userId, { limit: 100 });
    if (interests.items.length === 0) {
      await accounts.createInterest(userId, {
        type: "topic",
        name: "Climate science",
        description: "Major climate research and Earth observations",
        importance: 5,
        expertiseLevel: "intermediate",
        desiredDepth: "standard",
        alertSensitivity: 1,
        preferredSources: [],
        blockedSources: [],
        keywords: ["climate", "earth", "mission"],
        excludedKeywords: [],
      });
    }
  }

  const sources = new PostgresSourceRepository(pool);
  await sources.registerSource({
    key: "tempo-test-science",
    name: "Tempo Test Science Desk",
    homepageUrl: "https://example.com/science",
    feedUrl: "https://example.com/science/feed.xml",
    adapterKind: "rss",
    defaultLanguage: "en",
    fetchIntervalMinutes: 60,
  });
  const storyText =
    "A new Earth-observation mission published climate measurements that improve regional forecasting and establish a fresh baseline for researchers.";
  await sources.upsertSourceItems("tempo-test-science", [
    {
      sourceKey: "tempo-test-science",
      externalId: "test-climate-mission-1",
      canonicalUrl: "https://example.com/science/climate-mission",
      title: "New Earth mission sharpens climate observations",
      author: "Tempo Test Science Desk",
      publishedAt: setupTime.toISOString(),
      discoveredAt: setupTime.toISOString(),
      language: "en",
      excerpt: storyText,
      contentHash: createHash("sha256").update(storyText).digest("hex"),
      metadata: { fixture: true },
    },
  ]);

  const stories = new PostgresStoryRepository(pool);
  const intelligenceTime = new Date();
  const intelligence = await runIntelligenceCycle({
    jobs: new PostgresIntelligenceJobRepository(pool),
    stories,
    processor: new DeterministicIntelligenceProcessor(),
    workerId: `test-bootstrap-intelligence-${randomUUID()}`,
    now: intelligenceTime,
    limit: 25,
  });
  const generationTime = new Date();
  const generation = await runGenerationCycle({
    scheduleRepository: new PostgresScheduledBriefingRunRepository(pool),
    accountRepository: accounts,
    storyRepository: stories,
    briefingRepository: new PostgresBriefingRepository(pool),
    workerId: `test-bootstrap-generation-${randomUUID()}`,
    clock: { now: () => generationTime },
  });

  process.stdout.write(
    `${JSON.stringify({
      event: "tempo_test_environment_bootstrapped",
      intelligence: {
        claimed: intelligence.claimed,
        completed: intelligence.completed,
        failed: intelligence.failed,
      },
      generation: {
        claimed: generation.claimed,
        outcomeStatuses: generation.outcomes.map((outcome) => outcome.status),
      },
    })}\n`,
  );
} finally {
  await pool.end();
}

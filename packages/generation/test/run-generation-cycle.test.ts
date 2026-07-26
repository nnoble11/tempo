import {
  CanonicalBriefingSchema,
  SaveCanonicalBriefingCommandSchema,
  type CanonicalBriefing,
  type ScheduledBriefingRun,
  type UserPreferences,
} from "@tempo/contracts";
import type {
  AccountRepository,
  BriefingRepository,
  ScheduledBriefingRunRepository,
  StoryRepository,
} from "@tempo/database";
import { describe, expect, it } from "vitest";

import { runGenerationCycle } from "../src/index.js";
import {
  FIXTURE_IDS,
  fixtureCanonicalBriefing,
  fixtureInterest,
  fixtureStory,
} from "../../../test/fixtures/briefing.js";

const run: ScheduledBriefingRun = {
  id: "00000000-0000-4000-8000-000000000201",
  userId: FIXTURE_IDS.userId,
  localDate: "2026-07-18",
  scheduledFor: "2026-07-18T15:00:00.000Z",
  status: "processing",
  attemptCount: 1,
  candidateCount: 0,
  selectedCount: 0,
  briefingId: null,
  workerId: "worker-1",
  leaseExpiresAt: "2026-07-18T15:10:00.000Z",
  nextAttemptAt: null,
  lastError: null,
  startedAt: "2026-07-18T15:00:00.000Z",
  completedAt: null,
  createdAt: "2026-07-18T15:00:00.000Z",
  updatedAt: "2026-07-18T15:00:00.000Z",
};

const preferences: UserPreferences = {
  userId: FIXTURE_IDS.userId,
  timezone: "America/Los_Angeles",
  locale: "en-US",
  defaultBriefingMinutes: 5,
  dailyBriefingTime: "08:00",
  quietHoursStart: null,
  quietHoursEnd: null,
  deliveryChannels: ["in_app", "email"],
  calendarSuggestionsEnabled: false,
  recommendationsEnabled: false,
  createdAt: "2026-07-18T10:00:00.000Z",
  updatedAt: "2026-07-18T10:00:00.000Z",
};

class FakeScheduleRepository implements ScheduledBriefingRunRepository {
  public attached: unknown;
  public completed: unknown;
  public skipped: unknown;
  public failed: unknown;

  public constructor(private readonly claimedRun = run) {}

  public claimDueRuns(): Promise<ScheduledBriefingRun[]> {
    return Promise.resolve([this.claimedRun]);
  }

  public completeRun(command: unknown): Promise<void> {
    this.completed = command;
    return Promise.resolve();
  }

  public attachBriefing(command: unknown): Promise<void> {
    this.attached = command;
    return Promise.resolve();
  }

  public skipRun(command: unknown): Promise<void> {
    this.skipped = command;
    return Promise.resolve();
  }

  public failRun(command: unknown): Promise<void> {
    this.failed = command;
    return Promise.resolve();
  }

  public getRun(): Promise<ScheduledBriefingRun | null> {
    return Promise.resolve(run);
  }
}

const accountRepository = {
  getPreferences: () => Promise.resolve(preferences),
  listInterests: () =>
    Promise.resolve({
      items: [fixtureInterest()],
      nextCursor: null,
    }),
} as unknown as AccountRepository;

const briefingRepository: BriefingRepository = {
  saveCanonicalBriefing: (userId, input) => {
    const command = SaveCanonicalBriefingCommandSchema.parse(input);
    return Promise.resolve(
      CanonicalBriefingSchema.parse({
        ...command.briefing,
        id: FIXTURE_IDS.briefingId,
        userId,
        items: command.briefing.items.map((item, index) => ({
          ...item,
          id:
            index === 0
              ? FIXTURE_IDS.briefingItemId
              : "00000000-0000-4000-8000-000000000299",
          briefingId: FIXTURE_IDS.briefingId,
          createdAt: "2026-07-18T15:00:01.000Z",
        })),
        createdAt: "2026-07-18T15:00:01.000Z",
        updatedAt: "2026-07-18T15:00:01.000Z",
      }),
    );
  },
  getBriefing: () => Promise.resolve(null),
  getLatestBriefing: () => Promise.resolve(null),
  getBriefingByGenerationKey: () => Promise.resolve(null),
  listBriefings: () =>
    Promise.resolve({
      items: [],
      nextCursor: null,
    }),
  recordInteraction: () => Promise.resolve(null),
};

const storyRepository = (stories = [fixtureStory()]): StoryRepository =>
  ({
    listReadyStoryIntelligence: () => Promise.resolve(stories),
  }) as unknown as StoryRepository;

describe("scheduled generation cycle", () => {
  it("assembles, stores, observes, and completes a due briefing", async () => {
    const scheduleRepository = new FakeScheduleRepository();
    const handled: CanonicalBriefing[] = [];
    const summary = await runGenerationCycle({
      scheduleRepository,
      accountRepository,
      storyRepository: storyRepository(),
      briefingRepository,
      workerId: "worker-1",
      clock: {
        now: () => new Date("2026-07-18T15:00:01.000Z"),
      },
      onBriefingGenerated: (_userId, briefing) => {
        handled.push(briefing);
        return Promise.resolve();
      },
    });

    expect(summary).toMatchObject({
      claimed: 1,
      outcomes: [
        {
          status: "completed",
          candidateCount: 1,
          selectedCount: 1,
          briefingId: FIXTURE_IDS.briefingId,
        },
      ],
    });
    expect(handled).toHaveLength(1);
    expect(scheduleRepository.completed).toMatchObject({
      briefingId: FIXTURE_IDS.briefingId,
      candidateCount: 1,
      selectedCount: 1,
    });
  });

  it("records a clean skip when no story matches", async () => {
    const scheduleRepository = new FakeScheduleRepository();
    const summary = await runGenerationCycle({
      scheduleRepository,
      accountRepository,
      storyRepository: storyRepository([]),
      briefingRepository,
      workerId: "worker-1",
      clock: {
        now: () => new Date("2026-07-18T15:00:01.000Z"),
      },
    });

    expect(summary.outcomes[0]).toMatchObject({
      status: "skipped",
      candidateCount: 0,
    });
    expect(scheduleRepository.skipped).toMatchObject({
      reason: "No ready story candidate matched an active user interest.",
    });
  });

  it("records retry timing when downstream delivery scheduling fails", async () => {
    const scheduleRepository = new FakeScheduleRepository();
    const summary = await runGenerationCycle({
      scheduleRepository,
      accountRepository,
      storyRepository: storyRepository(),
      briefingRepository,
      workerId: "worker-1",
      retryBaseDelayMilliseconds: 60_000,
      clock: {
        now: () => new Date("2026-07-18T15:00:01.000Z"),
      },
      onBriefingGenerated: () =>
        Promise.reject(new Error("Delivery scheduling unavailable")),
    });

    expect(summary.outcomes[0]).toMatchObject({
      status: "failed",
      candidateCount: 1,
    });
    expect(scheduleRepository.failed).toMatchObject({
      nextAttemptAt: "2026-07-18T15:01:01.000Z",
      error: "Error: Delivery scheduling unavailable",
    });
  });

  it("resumes downstream work from an attached canonical briefing", async () => {
    const existing = fixtureCanonicalBriefing();
    const scheduleRepository = new FakeScheduleRepository({
      ...run,
      attemptCount: 2,
      candidateCount: 1,
      selectedCount: 1,
      briefingId: existing.id,
    });
    let saved = false;
    const handled: CanonicalBriefing[] = [];
    const recoveryRepository: BriefingRepository = {
      ...briefingRepository,
      getBriefing: () => Promise.resolve(existing),
      saveCanonicalBriefing: () => {
        saved = true;
        return Promise.reject(new Error("A recovery must not regenerate."));
      },
    };

    const summary = await runGenerationCycle({
      scheduleRepository,
      accountRepository,
      storyRepository: storyRepository(),
      briefingRepository: recoveryRepository,
      workerId: "worker-1",
      clock: {
        now: () => new Date("2026-07-18T15:02:00.000Z"),
      },
      onBriefingGenerated: (_userId, briefing) => {
        handled.push(briefing);
        return Promise.resolve();
      },
    });

    expect(saved).toBe(false);
    expect(handled).toEqual([existing]);
    expect(summary.outcomes[0]).toMatchObject({
      status: "completed",
      briefingId: existing.id,
      candidateCount: 1,
      selectedCount: 1,
    });
  });
});

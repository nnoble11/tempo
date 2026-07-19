import type { CanonicalBriefing, ScheduledBriefingRun } from "@tempo/contracts";
import type {
  AccountRepository,
  BriefingRepository,
  ScheduledBriefingRunRepository,
  StoryRepository,
} from "@tempo/database";
import {
  assembleScheduledBriefing,
  generateAndSaveGroundedBriefing,
  NoGroundedBriefingItemsError,
} from "@tempo/domain";

export type GenerationClock = {
  now(): Date;
};

export type GeneratedBriefingHandler = (
  userId: string,
  briefing: CanonicalBriefing,
) => Promise<void>;

export type RunGenerationCycleOptions = {
  scheduleRepository: ScheduledBriefingRunRepository;
  accountRepository: AccountRepository;
  storyRepository: StoryRepository;
  briefingRepository: BriefingRepository;
  workerId: string;
  maxRuns?: number;
  maxCandidates?: number;
  leaseDurationMilliseconds?: number;
  maxAttempts?: number;
  retryBaseDelayMilliseconds?: number;
  retryMaxDelayMilliseconds?: number;
  onBriefingGenerated?: GeneratedBriefingHandler;
  clock?: GenerationClock;
};

export type GenerationRunOutcome = {
  runId: string;
  userId: string;
  status: "completed" | "skipped" | "failed";
  candidateCount: number;
  selectedCount: number;
  briefingId?: string;
  error?: string;
};

export type GenerationCycleSummary = {
  workerId: string;
  claimed: number;
  outcomes: GenerationRunOutcome[];
};

type ResolvedConfiguration = {
  maxRuns: number;
  maxCandidates: number;
  leaseDurationMilliseconds: number;
  maxAttempts: number;
  retryBaseDelayMilliseconds: number;
  retryMaxDelayMilliseconds: number;
};

const defaultClock: GenerationClock = {
  now: () => new Date(),
};

const requireIntegerInRange = (
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
};

const resolveConfiguration = (
  options: RunGenerationCycleOptions,
): ResolvedConfiguration => {
  const configuration = {
    maxRuns: options.maxRuns ?? 10,
    maxCandidates: options.maxCandidates ?? 100,
    leaseDurationMilliseconds: options.leaseDurationMilliseconds ?? 10 * 60_000,
    maxAttempts: options.maxAttempts ?? 3,
    retryBaseDelayMilliseconds:
      options.retryBaseDelayMilliseconds ?? 5 * 60_000,
    retryMaxDelayMilliseconds:
      options.retryMaxDelayMilliseconds ?? 6 * 60 * 60_000,
  };
  requireIntegerInRange("maxRuns", configuration.maxRuns, 1, 100);
  requireIntegerInRange("maxCandidates", configuration.maxCandidates, 1, 200);
  requireIntegerInRange(
    "leaseDurationMilliseconds",
    configuration.leaseDurationMilliseconds,
    30_000,
    60 * 60_000,
  );
  requireIntegerInRange("maxAttempts", configuration.maxAttempts, 1, 10);
  requireIntegerInRange(
    "retryBaseDelayMilliseconds",
    configuration.retryBaseDelayMilliseconds,
    1_000,
    24 * 60 * 60_000,
  );
  requireIntegerInRange(
    "retryMaxDelayMilliseconds",
    configuration.retryMaxDelayMilliseconds,
    configuration.retryBaseDelayMilliseconds,
    7 * 24 * 60 * 60_000,
  );
  return configuration;
};

const errorDescription = (error: unknown): string =>
  error instanceof Error
    ? `${error.name}: ${error.message}`.slice(0, 2_000)
    : "Unknown scheduled briefing generation error";

const retryDelay = (
  attemptCount: number,
  configuration: ResolvedConfiguration,
): number =>
  Math.min(
    configuration.retryMaxDelayMilliseconds,
    configuration.retryBaseDelayMilliseconds *
      2 ** Math.max(0, attemptCount - 1),
  );

const processRun = async (
  run: ScheduledBriefingRun,
  options: RunGenerationCycleOptions,
  configuration: ResolvedConfiguration,
  clock: GenerationClock,
): Promise<GenerationRunOutcome> => {
  let candidateCount = 0;
  try {
    const generationKey = `scheduled-run:${run.id}`;
    const existingBriefing =
      run.briefingId === null
        ? await options.briefingRepository.getBriefingByGenerationKey(
            run.userId,
            generationKey,
          )
        : await options.briefingRepository.getBriefing(
            run.userId,
            run.briefingId,
          );
    if (run.briefingId !== null && existingBriefing === null) {
      throw new Error("The scheduled run's canonical briefing was not found.");
    }
    if (existingBriefing !== null) {
      candidateCount = Math.max(
        run.candidateCount,
        existingBriefing.items.length,
      );
      if (run.briefingId === null) {
        await options.scheduleRepository.attachBriefing({
          runId: run.id,
          workerId: options.workerId,
          briefingId: existingBriefing.id,
          candidateCount,
          selectedCount: existingBriefing.items.length,
          attachedAt: clock.now().toISOString(),
        });
      }
      if (options.onBriefingGenerated !== undefined) {
        await options.onBriefingGenerated(run.userId, existingBriefing);
      }
      const completedAt = clock.now().toISOString();
      await options.scheduleRepository.completeRun({
        runId: run.id,
        workerId: options.workerId,
        briefingId: existingBriefing.id,
        candidateCount,
        selectedCount: existingBriefing.items.length,
        completedAt,
      });
      return {
        runId: run.id,
        userId: run.userId,
        status: "completed",
        candidateCount,
        selectedCount: existingBriefing.items.length,
        briefingId: existingBriefing.id,
      };
    }

    const [preferences, interestPage, stories] = await Promise.all([
      options.accountRepository.getPreferences(run.userId),
      options.accountRepository.listInterests(run.userId, { limit: 100 }),
      options.storyRepository.listReadyStoryIntelligence(
        configuration.maxCandidates,
      ),
    ]);
    if (preferences === null) {
      throw new Error("The scheduled user has no briefing preferences.");
    }

    const assembly = assembleScheduledBriefing({
      targetMinutes: preferences.defaultBriefingMinutes,
      scheduledFor: run.scheduledFor,
      generatedAt: run.startedAt ?? run.scheduledFor,
      interests: interestPage.items,
      stories,
    });
    if (assembly === null) {
      const completedAt = clock.now().toISOString();
      await options.scheduleRepository.skipRun({
        runId: run.id,
        workerId: options.workerId,
        candidateCount: 0,
        reason: "No ready story candidate matched an active user interest.",
        completedAt,
      });
      return {
        runId: run.id,
        userId: run.userId,
        status: "skipped",
        candidateCount: 0,
        selectedCount: 0,
      };
    }
    candidateCount = assembly.matchedCandidateCount;

    let briefing: CanonicalBriefing;
    try {
      briefing = await generateAndSaveGroundedBriefing({
        writer: options.briefingRepository,
        userId: run.userId,
        idempotencyKey: generationKey,
        request: assembly.request,
      });
    } catch (error) {
      if (error instanceof NoGroundedBriefingItemsError) {
        const completedAt = clock.now().toISOString();
        await options.scheduleRepository.skipRun({
          runId: run.id,
          workerId: options.workerId,
          candidateCount,
          reason: "No matched grounded candidate fit the time budget.",
          completedAt,
        });
        return {
          runId: run.id,
          userId: run.userId,
          status: "skipped",
          candidateCount,
          selectedCount: 0,
        };
      }
      throw error;
    }

    await options.scheduleRepository.attachBriefing({
      runId: run.id,
      workerId: options.workerId,
      briefingId: briefing.id,
      candidateCount,
      selectedCount: briefing.items.length,
      attachedAt: clock.now().toISOString(),
    });
    if (options.onBriefingGenerated !== undefined) {
      await options.onBriefingGenerated(run.userId, briefing);
    }
    const completedAt = clock.now().toISOString();
    await options.scheduleRepository.completeRun({
      runId: run.id,
      workerId: options.workerId,
      briefingId: briefing.id,
      candidateCount,
      selectedCount: briefing.items.length,
      completedAt,
    });
    return {
      runId: run.id,
      userId: run.userId,
      status: "completed",
      candidateCount,
      selectedCount: briefing.items.length,
      briefingId: briefing.id,
    };
  } catch (error) {
    const failedAt = clock.now();
    const terminal = run.attemptCount >= configuration.maxAttempts;
    const description = errorDescription(error);
    await options.scheduleRepository.failRun({
      runId: run.id,
      workerId: options.workerId,
      candidateCount,
      error: description,
      failedAt: failedAt.toISOString(),
      nextAttemptAt: terminal
        ? null
        : new Date(
            failedAt.valueOf() + retryDelay(run.attemptCount, configuration),
          ).toISOString(),
    });
    return {
      runId: run.id,
      userId: run.userId,
      status: "failed",
      candidateCount,
      selectedCount: 0,
      error: description,
    };
  }
};

export const runGenerationCycle = async (
  options: RunGenerationCycleOptions,
): Promise<GenerationCycleSummary> => {
  if (options.workerId.trim().length === 0) {
    throw new Error("workerId is required.");
  }
  const configuration = resolveConfiguration(options);
  const clock = options.clock ?? defaultClock;
  const startedAt = clock.now();
  const runs = await options.scheduleRepository.claimDueRuns({
    workerId: options.workerId,
    now: startedAt.toISOString(),
    leaseUntil: new Date(
      startedAt.valueOf() + configuration.leaseDurationMilliseconds,
    ).toISOString(),
    limit: configuration.maxRuns,
  });
  const outcomes = await Promise.all(
    runs.map((run) => processRun(run, options, configuration, clock)),
  );
  return {
    workerId: options.workerId,
    claimed: runs.length,
    outcomes,
  };
};

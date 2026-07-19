import type { SourceItemUpsertResult } from "@tempo/contracts";
import type { ClaimedSource, SourceRepository } from "@tempo/database";
import {
  isRetryableSourceError,
  type HttpFetcher,
  type SourceAdapter,
  type SourceFetchResult,
} from "@tempo/source-adapters";

export type IngestionClock = {
  now(): Date;
  sleep(milliseconds: number): Promise<void>;
};

export type IngestionRetryPolicy = {
  maxAttempts: number;
  baseDelayMilliseconds: number;
  maxDelayMilliseconds: number;
};

export type IngestionFailureBackoff = {
  baseDelayMilliseconds: number;
  maxDelayMilliseconds: number;
};

export type RunIngestionCycleOptions = {
  adapters: readonly SourceAdapter[];
  repository: SourceRepository;
  fetcher: HttpFetcher;
  workerId: string;
  maxSources?: number;
  leaseDurationMilliseconds?: number;
  retryPolicy?: Partial<IngestionRetryPolicy>;
  failureBackoff?: Partial<IngestionFailureBackoff>;
  clock?: IngestionClock;
};

export type SourceIngestionOutcome = {
  sourceKey: string;
  status: "succeeded" | "not_modified" | "failed";
  attempts: number;
  rejected: number;
  upsert: SourceItemUpsertResult;
  error?: string;
};

export type IngestionCycleSummary = {
  workerId: string;
  claimed: number;
  outcomes: SourceIngestionOutcome[];
};

const defaultClock: IngestionClock = {
  now: () => new Date(),
  sleep: (milliseconds) =>
    new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    }),
};

const zeroUpsert = (): SourceItemUpsertResult => ({
  inserted: 0,
  updated: 0,
  unchanged: 0,
});

const boundedExponentialDelay = (
  baseDelayMilliseconds: number,
  maxDelayMilliseconds: number,
  exponent: number,
): number =>
  Math.min(
    maxDelayMilliseconds,
    baseDelayMilliseconds * 2 ** Math.max(0, exponent),
  );

const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 2_000);
  }
  return "Unknown ingestion error";
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

const resolveConfiguration = (options: RunIngestionCycleOptions) => {
  const retryPolicy: IngestionRetryPolicy = {
    maxAttempts: options.retryPolicy?.maxAttempts ?? 3,
    baseDelayMilliseconds: options.retryPolicy?.baseDelayMilliseconds ?? 500,
    maxDelayMilliseconds: options.retryPolicy?.maxDelayMilliseconds ?? 2_000,
  };
  const failureBackoff: IngestionFailureBackoff = {
    baseDelayMilliseconds:
      options.failureBackoff?.baseDelayMilliseconds ?? 5 * 60_000,
    maxDelayMilliseconds:
      options.failureBackoff?.maxDelayMilliseconds ?? 6 * 60 * 60_000,
  };
  const maxSources = options.maxSources ?? 10;
  const leaseDurationMilliseconds =
    options.leaseDurationMilliseconds ?? 10 * 60_000;

  requireIntegerInRange("maxSources", maxSources, 1, 100);
  requireIntegerInRange(
    "leaseDurationMilliseconds",
    leaseDurationMilliseconds,
    1_000,
    60 * 60_000,
  );
  requireIntegerInRange(
    "retryPolicy.maxAttempts",
    retryPolicy.maxAttempts,
    1,
    5,
  );
  requireIntegerInRange(
    "retryPolicy.baseDelayMilliseconds",
    retryPolicy.baseDelayMilliseconds,
    0,
    60_000,
  );
  requireIntegerInRange(
    "retryPolicy.maxDelayMilliseconds",
    retryPolicy.maxDelayMilliseconds,
    retryPolicy.baseDelayMilliseconds,
    5 * 60_000,
  );
  requireIntegerInRange(
    "failureBackoff.baseDelayMilliseconds",
    failureBackoff.baseDelayMilliseconds,
    1_000,
    24 * 60 * 60_000,
  );
  requireIntegerInRange(
    "failureBackoff.maxDelayMilliseconds",
    failureBackoff.maxDelayMilliseconds,
    failureBackoff.baseDelayMilliseconds,
    7 * 24 * 60 * 60_000,
  );

  return {
    retryPolicy,
    failureBackoff,
    maxSources,
    leaseDurationMilliseconds,
  };
};

const fetchWithRetry = async (
  adapter: SourceAdapter,
  lease: ClaimedSource,
  fetcher: HttpFetcher,
  discoveredAt: string,
  retryPolicy: IngestionRetryPolicy,
  clock: IngestionClock,
): Promise<
  | { result: SourceFetchResult; attempts: number }
  | { error: unknown; attempts: number }
> => {
  let attempts = 0;
  let lastError: unknown;

  while (attempts < retryPolicy.maxAttempts) {
    attempts += 1;
    try {
      return {
        result: await adapter.fetch(fetcher, {
          discoveredAt,
          ...(lease.etag === null ? {} : { etag: lease.etag }),
          ...(lease.lastModified === null
            ? {}
            : { lastModified: lease.lastModified }),
        }),
        attempts,
      };
    } catch (error) {
      lastError = error;
      if (
        attempts >= retryPolicy.maxAttempts ||
        !isRetryableSourceError(error)
      ) {
        break;
      }
      await clock.sleep(
        boundedExponentialDelay(
          retryPolicy.baseDelayMilliseconds,
          retryPolicy.maxDelayMilliseconds,
          attempts - 1,
        ),
      );
    }
  }

  return { error: lastError, attempts };
};

const processClaimedSource = async (
  lease: ClaimedSource,
  adapter: SourceAdapter,
  options: {
    repository: SourceRepository;
    fetcher: HttpFetcher;
    workerId: string;
    retryPolicy: IngestionRetryPolicy;
    failureBackoff: IngestionFailureBackoff;
    clock: IngestionClock;
    discoveredAt: string;
  },
): Promise<SourceIngestionOutcome> => {
  const fetchOutcome = await fetchWithRetry(
    adapter,
    lease,
    options.fetcher,
    options.discoveredAt,
    options.retryPolicy,
    options.clock,
  );

  if ("result" in fetchOutcome) {
    const { result } = fetchOutcome;
    if (
      !result.notModified &&
      result.items.length === 0 &&
      result.rejected.length > 0
    ) {
      return recordFailure(
        lease,
        new Error("Every source entry was rejected during normalization."),
        fetchOutcome.attempts,
        options,
        result.rejected.length,
      );
    }

    let upsert = zeroUpsert();
    try {
      if (!result.notModified && result.items.length > 0) {
        upsert = await options.repository.upsertSourceItems(
          lease.source.key,
          result.items,
        );
      }
    } catch (error) {
      return recordFailure(
        lease,
        error,
        fetchOutcome.attempts,
        options,
        result.rejected.length,
      );
    }

    const fetchedAt = options.clock.now();
    const nextFetchAt = new Date(
      fetchedAt.valueOf() + lease.source.fetchIntervalMinutes * 60_000,
    );
    await options.repository.recordSourceFetchSuccess({
      sourceKey: lease.source.key,
      workerId: options.workerId,
      fetchedAt: fetchedAt.toISOString(),
      nextFetchAt: nextFetchAt.toISOString(),
      etag: result.notModified ? (result.etag ?? lease.etag) : result.etag,
      lastModified: result.notModified
        ? (result.lastModified ?? lease.lastModified)
        : result.lastModified,
    });

    return {
      sourceKey: lease.source.key,
      status: result.notModified ? "not_modified" : "succeeded",
      attempts: fetchOutcome.attempts,
      rejected: result.rejected.length,
      upsert,
    };
  }

  return recordFailure(
    lease,
    fetchOutcome.error,
    fetchOutcome.attempts,
    options,
  );
};

const recordFailure = async (
  lease: ClaimedSource,
  error: unknown,
  attempts: number,
  options: {
    repository: SourceRepository;
    workerId: string;
    failureBackoff: IngestionFailureBackoff;
    clock: IngestionClock;
  },
  rejected = 0,
): Promise<SourceIngestionOutcome> => {
  const attemptedAt = options.clock.now();
  const delay = boundedExponentialDelay(
    options.failureBackoff.baseDelayMilliseconds,
    options.failureBackoff.maxDelayMilliseconds,
    lease.consecutiveFailures,
  );
  const errorDescription = describeError(error);
  await options.repository.recordSourceFetchFailure({
    sourceKey: lease.source.key,
    workerId: options.workerId,
    attemptedAt: attemptedAt.toISOString(),
    nextFetchAt: new Date(attemptedAt.valueOf() + delay).toISOString(),
    error: errorDescription,
  });

  return {
    sourceKey: lease.source.key,
    status: "failed",
    attempts,
    rejected,
    upsert: zeroUpsert(),
    error: errorDescription,
  };
};

export const runIngestionCycle = async (
  options: RunIngestionCycleOptions,
): Promise<IngestionCycleSummary> => {
  if (options.workerId.trim().length === 0) {
    throw new Error("workerId is required.");
  }
  const configuration = resolveConfiguration(options);
  const clock = options.clock ?? defaultClock;
  const adapterBySourceKey = new Map<string, SourceAdapter>();
  for (const adapter of options.adapters) {
    if (adapterBySourceKey.has(adapter.source.key)) {
      throw new Error(`Duplicate source adapter: ${adapter.source.key}`);
    }
    adapterBySourceKey.set(adapter.source.key, adapter);
    await options.repository.registerSource(adapter.source);
  }

  const startedAt = clock.now();
  const claimed = await options.repository.claimDueSources({
    workerId: options.workerId,
    now: startedAt.toISOString(),
    leaseUntil: new Date(
      startedAt.valueOf() + configuration.leaseDurationMilliseconds,
    ).toISOString(),
    sourceKeys: [...adapterBySourceKey.keys()],
    limit: configuration.maxSources,
  });

  const outcomes = await Promise.all(
    claimed.map((lease) => {
      const adapter = adapterBySourceKey.get(lease.source.key);
      if (adapter === undefined) {
        throw new Error(`No adapter is registered for ${lease.source.key}.`);
      }
      return processClaimedSource(lease, adapter, {
        repository: options.repository,
        fetcher: options.fetcher,
        workerId: options.workerId,
        retryPolicy: configuration.retryPolicy,
        failureBackoff: configuration.failureBackoff,
        clock,
        discoveredAt: startedAt.toISOString(),
      });
    }),
  );

  return {
    workerId: options.workerId,
    claimed: claimed.length,
    outcomes,
  };
};

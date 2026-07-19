import type { Delivery } from "@tempo/contracts";
import type { DeliveryRepository } from "@tempo/database";

import { DeliveryProviderError, type DeliveryProvider } from "./providers.js";

export type DeliveryClock = {
  now(): Date;
};

export type RunDeliveryCycleOptions = {
  repository: DeliveryRepository;
  providers: {
    providerFor(channel: Delivery["channel"]): DeliveryProvider;
  };
  workerId: string;
  maxDeliveries?: number;
  leaseDurationMilliseconds?: number;
  maxAttempts?: number;
  retryBaseDelayMilliseconds?: number;
  retryMaxDelayMilliseconds?: number;
  clock?: DeliveryClock;
};

export type DeliveryOutcome = {
  deliveryId: string;
  channel: Delivery["channel"];
  status: "sent" | "failed";
  attemptCount: number;
  providerMessageId?: string;
  error?: string;
};

export type DeliveryCycleSummary = {
  workerId: string;
  claimed: number;
  outcomes: DeliveryOutcome[];
};

const defaultClock: DeliveryClock = {
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

const describeError = (error: unknown): string =>
  error instanceof Error
    ? `${error.name}: ${error.message}`.slice(0, 2_000)
    : "Unknown delivery provider error";

const processDelivery = async (
  delivery: Delivery,
  options: RunDeliveryCycleOptions,
  configuration: {
    maxAttempts: number;
    retryBaseDelayMilliseconds: number;
    retryMaxDelayMilliseconds: number;
  },
  clock: DeliveryClock,
): Promise<DeliveryOutcome> => {
  try {
    const provider = options.providers.providerFor(delivery.channel);
    const result = await provider.send(delivery);
    const sentAt = clock.now().toISOString();
    await options.repository.markDeliverySent({
      deliveryId: delivery.id,
      workerId: options.workerId,
      providerMessageId: result.providerMessageId,
      sentAt,
    });
    return {
      deliveryId: delivery.id,
      channel: delivery.channel,
      status: "sent",
      attemptCount: delivery.attemptCount,
      providerMessageId: result.providerMessageId,
    };
  } catch (error) {
    const failedAt = clock.now();
    const retryable =
      !(error instanceof DeliveryProviderError) || error.retryable;
    const terminal =
      !retryable || delivery.attemptCount >= configuration.maxAttempts;
    const delay = Math.min(
      configuration.retryMaxDelayMilliseconds,
      configuration.retryBaseDelayMilliseconds *
        2 ** Math.max(0, delivery.attemptCount - 1),
    );
    const description = describeError(error);
    await options.repository.markDeliveryFailed({
      deliveryId: delivery.id,
      workerId: options.workerId,
      error: description,
      failedAt: failedAt.toISOString(),
      nextAttemptAt: terminal
        ? null
        : new Date(failedAt.valueOf() + delay).toISOString(),
    });
    return {
      deliveryId: delivery.id,
      channel: delivery.channel,
      status: "failed",
      attemptCount: delivery.attemptCount,
      error: description,
    };
  }
};

export const runDeliveryCycle = async (
  options: RunDeliveryCycleOptions,
): Promise<DeliveryCycleSummary> => {
  if (options.workerId.trim().length === 0) {
    throw new Error("workerId is required.");
  }
  const maxDeliveries = options.maxDeliveries ?? 50;
  const leaseDurationMilliseconds =
    options.leaseDurationMilliseconds ?? 5 * 60_000;
  const maxAttempts = options.maxAttempts ?? 5;
  const retryBaseDelayMilliseconds =
    options.retryBaseDelayMilliseconds ?? 60_000;
  const retryMaxDelayMilliseconds =
    options.retryMaxDelayMilliseconds ?? 6 * 60 * 60_000;
  requireIntegerInRange("maxDeliveries", maxDeliveries, 1, 100);
  requireIntegerInRange(
    "leaseDurationMilliseconds",
    leaseDurationMilliseconds,
    30_000,
    60 * 60_000,
  );
  requireIntegerInRange("maxAttempts", maxAttempts, 1, 10);
  requireIntegerInRange(
    "retryBaseDelayMilliseconds",
    retryBaseDelayMilliseconds,
    1_000,
    24 * 60 * 60_000,
  );
  requireIntegerInRange(
    "retryMaxDelayMilliseconds",
    retryMaxDelayMilliseconds,
    retryBaseDelayMilliseconds,
    7 * 24 * 60 * 60_000,
  );

  const clock = options.clock ?? defaultClock;
  const startedAt = clock.now();
  const deliveries = await options.repository.claimDueDeliveries({
    workerId: options.workerId,
    now: startedAt.toISOString(),
    leaseUntil: new Date(
      startedAt.valueOf() + leaseDurationMilliseconds,
    ).toISOString(),
    limit: maxDeliveries,
  });
  const outcomes = await Promise.all(
    deliveries.map((delivery) =>
      processDelivery(
        delivery,
        options,
        {
          maxAttempts,
          retryBaseDelayMilliseconds,
          retryMaxDelayMilliseconds,
        },
        clock,
      ),
    ),
  );
  return {
    workerId: options.workerId,
    claimed: deliveries.length,
    outcomes,
  };
};

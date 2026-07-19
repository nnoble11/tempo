import { DeliverySchema, type Delivery } from "@tempo/contracts";
import type { DeliveryRepository } from "@tempo/database";
import { describe, expect, it } from "vitest";

import {
  DeliveryProviderError,
  runDeliveryCycle,
  type DeliveryProvider,
} from "../src/index.js";
import { FIXTURE_IDS } from "../../../test/fixtures/briefing.js";

const claimedDelivery = DeliverySchema.parse({
  id: "00000000-0000-4000-8000-000000000501",
  userId: FIXTURE_IDS.userId,
  briefingId: FIXTURE_IDS.briefingId,
  endpointId: null,
  channel: "push",
  destination: "ExpoPushToken[fixture-token]",
  destinationHash: "a".repeat(64),
  payload: {
    channel: "push",
    to: "ExpoPushToken[fixture-token]",
    title: "Tempo",
    body: "Your briefing is ready.",
    url: "https://tempo.example/briefings/1",
    data: {
      briefingId: FIXTURE_IDS.briefingId,
      url: "https://tempo.example/briefings/1",
    },
  },
  status: "processing",
  scheduledFor: "2026-07-18T15:00:00.000Z",
  nextAttemptAt: null,
  attemptCount: 1,
  workerId: "delivery-worker",
  leaseExpiresAt: "2026-07-18T15:05:00.000Z",
  providerMessageId: null,
  lastError: null,
  sentAt: null,
  receiptStatus: null,
  receiptCheckedAt: null,
  receiptError: null,
  idempotencyKey: "delivery-1",
  createdAt: "2026-07-18T15:00:00.000Z",
  updatedAt: "2026-07-18T15:00:00.000Z",
});

type DeliveryUpdates = {
  sent: unknown[];
  failed: unknown[];
};

const repository = (
  deliveries: Delivery[],
  updates: DeliveryUpdates,
): DeliveryRepository =>
  ({
    claimDueDeliveries: () => Promise.resolve(deliveries),
    markDeliverySent: (command: unknown) => {
      updates.sent.push(command);
      return Promise.resolve();
    },
    markDeliveryFailed: (command: unknown) => {
      updates.failed.push(command);
      return Promise.resolve();
    },
  }) as unknown as DeliveryRepository;

describe("delivery cycle", () => {
  it("records provider success under the claimed lease", async () => {
    const updates: DeliveryUpdates = { sent: [], failed: [] };
    const provider: DeliveryProvider = {
      channel: "push",
      send: () => Promise.resolve({ providerMessageId: "receipt-1" }),
    };
    const summary = await runDeliveryCycle({
      repository: repository([claimedDelivery], updates),
      providers: {
        providerFor: () => provider,
      },
      workerId: "delivery-worker",
      clock: {
        now: () => new Date("2026-07-18T15:00:01.000Z"),
      },
    });

    expect(summary.outcomes[0]).toMatchObject({
      status: "sent",
      providerMessageId: "receipt-1",
    });
    expect(updates.sent[0]).toMatchObject({
      deliveryId: claimedDelivery.id,
      workerId: "delivery-worker",
    });
  });

  it("does not retry a permanent provider rejection", async () => {
    const updates: DeliveryUpdates = { sent: [], failed: [] };
    const provider: DeliveryProvider = {
      channel: "push",
      send: () =>
        Promise.reject(
          new DeliveryProviderError("Endpoint is unregistered.", false),
        ),
    };
    const summary = await runDeliveryCycle({
      repository: repository([claimedDelivery], updates),
      providers: {
        providerFor: () => provider,
      },
      workerId: "delivery-worker",
      clock: {
        now: () => new Date("2026-07-18T15:00:01.000Z"),
      },
    });

    expect(summary.outcomes[0]).toMatchObject({
      status: "failed",
    });
    expect(updates.failed[0]).toMatchObject({
      nextAttemptAt: null,
      error: "DeliveryProviderError: Endpoint is unregistered.",
    });
  });
});

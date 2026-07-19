import type { DeliveryRepository } from "@tempo/database";
import { describe, expect, it } from "vitest";

import { ExpoPushReceiptClient, runPushReceiptCycle } from "../src/index.js";

const claimed = {
  deliveryId: "00000000-0000-4000-8000-000000000981",
  endpointId: "00000000-0000-4000-8000-000000000982",
  providerMessageId: "receipt-1",
  attemptCount: 1,
};

describe("Expo push receipt reconciliation", () => {
  it("records accepted receipts", async () => {
    const accepted: unknown[] = [];
    const repository = {
      claimPushReceipts: () => Promise.resolve([claimed]),
      markPushReceiptAccepted: (...args: unknown[]) => {
        accepted.push(args);
        return Promise.resolve();
      },
      markPushReceiptFailed: () => Promise.resolve(),
    } as unknown as DeliveryRepository;
    const client = new ExpoPushReceiptClient({
      fetcher: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ data: { "receipt-1": { status: "ok" } } }),
            { status: 200 },
          ),
        ),
    });

    await expect(
      runPushReceiptCycle({
        repository,
        client,
        workerId: "receipt-worker",
        now: new Date("2026-07-18T15:01:00.000Z"),
      }),
    ).resolves.toEqual({ claimed: 1, accepted: 1, failed: 0 });
    expect(accepted).toHaveLength(1);
  });

  it("marks unregistered devices terminal and requests endpoint cleanup", async () => {
    const failed: unknown[][] = [];
    const repository = {
      claimPushReceipts: () => Promise.resolve([claimed]),
      markPushReceiptAccepted: () => Promise.resolve(),
      markPushReceiptFailed: (...args: unknown[]) => {
        failed.push(args);
        return Promise.resolve();
      },
    } as unknown as DeliveryRepository;
    const client = new ExpoPushReceiptClient({
      fetcher: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                "receipt-1": {
                  status: "error",
                  message: "Device is not registered.",
                  details: { error: "DeviceNotRegistered" },
                },
              },
            }),
            { status: 200 },
          ),
        ),
    });

    await runPushReceiptCycle({
      repository,
      client,
      workerId: "receipt-worker",
      now: new Date("2026-07-18T15:01:00.000Z"),
    });
    expect(failed[0]?.at(-2)).toBeNull();
    expect(failed[0]?.at(-1)).toBe(true);
  });
});

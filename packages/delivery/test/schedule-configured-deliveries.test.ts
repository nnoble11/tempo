import type { Delivery, SaveDeliveryCommand } from "@tempo/contracts";
import type { DeliveryRepository } from "@tempo/database";
import { describe, expect, it } from "vitest";

import { ConfiguredDeliveryScheduler } from "../src/index.js";
import {
  FIXTURE_IDS,
  fixtureCanonicalBriefing,
} from "../../../test/fixtures/briefing.js";

describe("configured delivery scheduling", () => {
  it("schedules only selected and verified endpoint channels", async () => {
    const saved: SaveDeliveryCommand[] = [];
    const repository = {
      getConfiguration: () =>
        Promise.resolve({
          timezone: "UTC",
          quietHoursStart: null,
          quietHoursEnd: null,
          preferredChannels: ["in_app", "push", "email"],
          endpoints: [
            {
              id: "00000000-0000-4000-8000-000000000601",
              userId: FIXTURE_IDS.userId,
              channel: "push",
              destination: "ExpoPushToken[fixture-token]",
              enabled: true,
              verificationStatus: "verified",
              verifiedAt: "2026-07-18T10:00:00.000Z",
              createdAt: "2026-07-18T10:00:00.000Z",
              updatedAt: "2026-07-18T10:00:00.000Z",
            },
            {
              id: "00000000-0000-4000-8000-000000000602",
              userId: FIXTURE_IDS.userId,
              channel: "sms",
              destination: "+14155550123",
              enabled: true,
              verificationStatus: "verified",
              verifiedAt: "2026-07-18T10:00:00.000Z",
              createdAt: "2026-07-18T10:00:00.000Z",
              updatedAt: "2026-07-18T10:00:00.000Z",
            },
            {
              id: "00000000-0000-4000-8000-000000000603",
              userId: FIXTURE_IDS.userId,
              channel: "email",
              destination: "reader@example.com",
              enabled: true,
              verificationStatus: "verified",
              verifiedAt: "2026-07-18T10:00:00.000Z",
              createdAt: "2026-07-18T10:00:00.000Z",
              updatedAt: "2026-07-18T10:00:00.000Z",
            },
          ],
        }),
      saveDelivery: (_userId: string, input: unknown) => {
        saved.push(input as SaveDeliveryCommand);
        return Promise.resolve(input as Delivery);
      },
    } as unknown as DeliveryRepository;
    const scheduler = new ConfiguredDeliveryScheduler({
      repository,
      briefingBaseUrl: "https://tempo.example",
    });

    await scheduler.scheduleForBriefing(
      FIXTURE_IDS.userId,
      fixtureCanonicalBriefing(),
    );

    expect(saved.map(({ channel }) => channel).sort()).toEqual([
      "email",
      "push",
    ]);
    expect(saved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: "push",
          endpointId: "00000000-0000-4000-8000-000000000601",
          scheduledFor: "2026-07-18T15:00:00.000Z",
        }),
        expect.objectContaining({
          channel: "email",
          endpointId: "00000000-0000-4000-8000-000000000603",
          destination: "reader@example.com",
        }),
      ]),
    );
    expect(saved.every(({ requestHash }) => requestHash.length === 64)).toBe(
      true,
    );
  });
});

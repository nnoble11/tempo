import {
  DeliverySchema,
  type Delivery,
  type DeliveryPayload,
} from "@tempo/contracts";
import { describe, expect, it } from "vitest";

import {
  DeliveryProviderError,
  ExpoPushProvider,
  ResendEmailProvider,
  TwilioSmsProvider,
} from "../src/index.js";
import { FIXTURE_IDS } from "../../../test/fixtures/briefing.js";

const delivery = (payload: DeliveryPayload): Delivery =>
  DeliverySchema.parse({
    id: "00000000-0000-4000-8000-000000000401",
    userId: FIXTURE_IDS.userId,
    briefingId: FIXTURE_IDS.briefingId,
    endpointId: null,
    channel: payload.channel,
    destination: payload.to,
    destinationHash: "d".repeat(64),
    payload,
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
    idempotencyKey: "delivery-fixture",
    createdAt: "2026-07-18T15:00:00.000Z",
    updatedAt: "2026-07-18T15:00:00.000Z",
  });

describe("delivery providers", () => {
  it("sends each typed payload through its provider boundary", async () => {
    const requests: RequestInfo[] = [];
    const expo = new ExpoPushProvider({
      fetcher: (input) => {
        requests.push(input);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                status: "ok",
                id: "expo-receipt-1",
              },
            }),
            { status: 200 },
          ),
        );
      },
    });
    const resend = new ResendEmailProvider({
      apiKey: "resend-key",
      from: "Tempo <briefings@example.com>",
      fetcher: (input) => {
        requests.push(input);
        return Promise.resolve(
          new Response(JSON.stringify({ id: "email-message-1" }), {
            status: 200,
          }),
        );
      },
    });
    const twilio = new TwilioSmsProvider({
      accountSid: "AC00000000000000000000000000000000",
      authToken: "twilio-token",
      fromNumber: "+14155550100",
      fetcher: (input) => {
        requests.push(input);
        return Promise.resolve(
          new Response(JSON.stringify({ sid: "SM-message-1" }), {
            status: 201,
          }),
        );
      },
    });

    await expect(
      expo.send(
        delivery({
          channel: "push",
          to: "ExpoPushToken[fixture-token]",
          title: "Tempo",
          body: "Your briefing is ready.",
          url: "https://tempo.example/briefings/1",
          data: {
            briefingId: FIXTURE_IDS.briefingId,
            url: "https://tempo.example/briefings/1",
          },
        }),
      ),
    ).resolves.toEqual({ providerMessageId: "expo-receipt-1" });
    await expect(
      resend.send(
        delivery({
          channel: "email",
          to: "reader@example.com",
          subject: "Tempo",
          text: "Your briefing is ready.",
          html: "<p>Your briefing is ready.</p>",
        }),
      ),
    ).resolves.toEqual({ providerMessageId: "email-message-1" });
    await expect(
      twilio.send(
        delivery({
          channel: "sms",
          to: "+14155550123",
          body: "Your Tempo briefing is ready.",
          url: "https://tempo.example/briefings/1",
        }),
      ),
    ).resolves.toEqual({ providerMessageId: "SM-message-1" });
    expect(requests.map(String)).toEqual([
      "https://exp.host/--/api/v2/push/send",
      "https://api.resend.com/emails",
      "https://api.twilio.com/2010-04-01/Accounts/AC00000000000000000000000000000000/Messages.json",
    ]);
  });

  it("marks an unregistered Expo endpoint as non-retryable", async () => {
    const provider = new ExpoPushProvider({
      fetcher: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                status: "error",
                details: {
                  error: "DeviceNotRegistered",
                },
              },
            }),
            { status: 200 },
          ),
        ),
    });

    const error = await provider
      .send(
        delivery({
          channel: "push",
          to: "ExpoPushToken[stale-token]",
          title: "Tempo",
          body: "Your briefing is ready.",
          url: "https://tempo.example/briefings/1",
          data: {
            briefingId: FIXTURE_IDS.briefingId,
            url: "https://tempo.example/briefings/1",
          },
        }),
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DeliveryProviderError);
    expect((error as DeliveryProviderError).retryable).toBe(false);
  });
});

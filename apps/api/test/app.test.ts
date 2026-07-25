import { DeliveryProviderError } from "@tempo/delivery";
import type { DeliveryEndpoint, UserProfile } from "@tempo/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { createUnusedDependencies } from "./test-dependencies.js";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("Tempo API", () => {
  it("reports health", async () => {
    const app = buildApp(createUnusedDependencies());
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns a stable validation error for an invalid briefing plan", async () => {
    const app = buildApp(createUnusedDependencies());
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/briefings/plan",
      payload: {
        targetMinutes: 0,
        candidates: [],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: "INVALID_REQUEST",
      },
    });
  });

  it("requires authentication for user-owned endpoints", async () => {
    const app = buildApp(createUnusedDependencies());
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/users/me",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
    });
  });

  it("reports an unconfigured delivery provider as a stable 503", async () => {
    const dependencies = createUnusedDependencies();
    const smsEndpoint: DeliveryEndpoint = {
      id: "6f7d2f5e-95a5-4e42-b1de-6d5c7f6a6e01",
      userId: "1f0c1f9e-3b3f-4f4e-9d0a-2c8b7a6d5e02",
      channel: "sms",
      destination: "+14155550123",
      enabled: true,
      verificationStatus: "pending",
      verifiedAt: null,
      createdAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:00:00.000Z",
    };
    dependencies.deliveryRepository.requestEndpointVerification = () =>
      Promise.resolve(smsEndpoint);
    // The verification route only ensures the user exists; it ignores the
    // returned profile, so the stub does not need a populated one.
    dependencies.accountRepository.ensureUser = () =>
      Promise.resolve(undefined as unknown as UserProfile);
    const app = buildApp({
      ...dependencies,
      accessTokenVerifier: {
        verify: () =>
          Promise.resolve({ userId: smsEndpoint.userId, email: null }),
      },
      verificationSender: {
        sendCode: () =>
          Promise.reject(
            new DeliveryProviderError(
              "SMS verification is not configured.",
              false,
            ),
          ),
      },
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: `/v1/delivery-endpoints/${smsEndpoint.id}/verification`,
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: "DELIVERY_PROVIDER_UNAVAILABLE",
        message: "SMS verification is not configured.",
        details: {
          retryable: false,
        },
      },
    });
  });

  it("allows configured web origins and rejects other browser origins", async () => {
    const app = buildApp({
      ...createUnusedDependencies(),
      allowedOrigins: ["https://test.tempo.example"],
    });
    apps.push(app);

    const allowed = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "https://test.tempo.example",
        "access-control-request-method": "GET",
      },
    });
    const rejected = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "https://untrusted.example",
        "access-control-request-method": "GET",
      },
    });

    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://test.tempo.example",
    );
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

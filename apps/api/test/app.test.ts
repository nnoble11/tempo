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

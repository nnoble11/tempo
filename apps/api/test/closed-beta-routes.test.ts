import type {
  BriefingItemState,
  CalendarAvailability,
  CalendarConnection,
  UserProfile,
} from "@tempo/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { createUnusedDependencies } from "./test-dependencies.js";

const aliceId = "00000000-0000-4000-8000-000000000021";
const bobId = "00000000-0000-4000-8000-000000000022";
const itemId = "00000000-0000-4000-8000-000000000023";
const briefingId = "00000000-0000-4000-8000-000000000024";
const connectionId = "00000000-0000-4000-8000-000000000025";
const now = "2026-07-25T17:00:00.000Z";

const profile = (userId: string): UserProfile => ({
  user: {
    id: userId,
    email: null,
    onboardingCompletedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  preferences: {
    userId,
    timezone: "UTC",
    locale: "en-US",
    defaultBriefingMinutes: 5,
    dailyBriefingTime: "08:00",
    quietHoursStart: null,
    quietHoursEnd: null,
    deliveryChannels: ["in_app"],
    calendarSuggestionsEnabled: true,
    recommendationsEnabled: false,
    createdAt: now,
    updatedAt: now,
  },
});

const state: BriefingItemState = {
  id: "00000000-0000-4000-8000-000000000026",
  briefingItemId: itemId,
  savedAt: now,
  deferredAt: null,
  createdAt: now,
  updatedAt: now,
};

const connection: CalendarConnection = {
  id: connectionId,
  provider: "device",
  displayName: "This iPhone",
  scope: "free_busy",
  active: true,
  lastSyncedAt: now,
  createdAt: now,
  updatedAt: now,
};

const availability: CalendarAvailability = {
  connection,
  suggestion: {
    startsAt: "2026-07-25T17:10:00.000Z",
    endsAt: "2026-07-25T17:30:00.000Z",
    availableMinutes: 20,
    suggestedBriefingMinutes: 5,
  },
  rangeStartsAt: now,
  rangeEndsAt: "2026-07-25T21:00:00.000Z",
};

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

const createApp = () => {
  const dependencies = createUnusedDependencies();
  dependencies.accessTokenVerifier.verify = (token) =>
    Promise.resolve({
      userId: token === "alice-token" ? aliceId : bobId,
      email: null,
    });
  dependencies.accountRepository.ensureUser = (identity) =>
    Promise.resolve(profile(identity.id));
  dependencies.libraryRepository.updateItemState = (
    userId,
    requestedItemId,
    input,
  ) =>
    Promise.resolve(
      userId === aliceId && requestedItemId === itemId
        ? {
            found: true,
            state:
              input.saved === false && input.deferred === false ? null : state,
          }
        : { found: false, state: null },
    );
  dependencies.libraryRepository.listBriefingItemStates = (
    userId,
    requestedBriefingId,
  ) =>
    Promise.resolve(
      userId === aliceId && requestedBriefingId === briefingId ? [state] : [],
    );
  dependencies.libraryRepository.listItems = () =>
    Promise.resolve({ items: [], nextCursor: null });
  dependencies.calendarRepository.connectDeviceCalendar = () =>
    Promise.resolve(connection);
  dependencies.calendarRepository.syncAvailability = (
    userId,
    requestedConnectionId,
  ) =>
    Promise.resolve(
      userId === aliceId && requestedConnectionId === connectionId
        ? connection
        : null,
    );
  dependencies.calendarRepository.getAvailability = (userId) =>
    Promise.resolve(
      userId === aliceId
        ? availability
        : {
            connection: null,
            suggestion: null,
            rangeStartsAt: null,
            rangeEndsAt: null,
          },
    );
  dependencies.calendarRepository.disconnect = (
    userId,
    requestedConnectionId,
  ) =>
    Promise.resolve(
      userId === aliceId && requestedConnectionId === connectionId,
    );

  const app = buildApp(dependencies);
  apps.push(app);
  return app;
};

describe("closed-beta API routes", () => {
  it("persists and clears current item state without crossing owners", async () => {
    const app = createApp();
    const saved = await app.inject({
      method: "PUT",
      url: `/v1/briefing-items/${itemId}/state`,
      headers: { authorization: "Bearer alice-token" },
      payload: { saved: true },
    });
    const cleared = await app.inject({
      method: "PUT",
      url: `/v1/briefing-items/${itemId}/state`,
      headers: { authorization: "Bearer alice-token" },
      payload: { saved: false, deferred: false },
    });
    const crossUser = await app.inject({
      method: "PUT",
      url: `/v1/briefing-items/${itemId}/state`,
      headers: { authorization: "Bearer bob-token" },
      payload: { saved: true },
    });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      briefingItemId: itemId,
      savedAt: now,
    });
    expect(cleared.statusCode).toBe(204);
    expect(crossUser.statusCode).toBe(404);
    expect(crossUser.json()).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("lists per-briefing state and both durable collections", async () => {
    const app = createApp();
    const states = await app.inject({
      method: "GET",
      url: `/v1/briefings/${briefingId}/item-states`,
      headers: { authorization: "Bearer alice-token" },
    });
    const saved = await app.inject({
      method: "GET",
      url: "/v1/library/saved?limit=10",
      headers: { authorization: "Bearer alice-token" },
    });
    const later = await app.inject({
      method: "GET",
      url: "/v1/library/later?limit=10",
      headers: { authorization: "Bearer alice-token" },
    });

    expect(states.json()).toEqual({ items: [state] });
    expect(saved.json()).toEqual({ items: [], nextCursor: null });
    expect(later.json()).toEqual({ items: [], nextCursor: null });
  });

  it("connects, synchronizes, reads, and disconnects free/busy availability", async () => {
    const app = createApp();
    const connected = await app.inject({
      method: "PUT",
      url: "/v1/calendar/connections/device",
      headers: { authorization: "Bearer alice-token" },
      payload: { displayName: "This iPhone" },
    });
    const synchronized = await app.inject({
      method: "POST",
      url: `/v1/calendar/connections/${connectionId}/availability`,
      headers: { authorization: "Bearer alice-token" },
      payload: {
        timezone: "America/Los_Angeles",
        rangeStartsAt: now,
        rangeEndsAt: "2026-07-25T21:00:00.000Z",
        busyWindows: [
          {
            startsAt: "2026-07-25T18:00:00.000Z",
            endsAt: "2026-07-25T18:30:00.000Z",
          },
        ],
      },
    });
    const read = await app.inject({
      method: "GET",
      url: `/v1/calendar/availability?minimumMinutes=5&now=${encodeURIComponent(now)}`,
      headers: { authorization: "Bearer alice-token" },
    });
    const disconnected = await app.inject({
      method: "DELETE",
      url: `/v1/calendar/connections/${connectionId}`,
      headers: { authorization: "Bearer alice-token" },
    });
    const crossUser = await app.inject({
      method: "DELETE",
      url: `/v1/calendar/connections/${connectionId}`,
      headers: { authorization: "Bearer bob-token" },
    });

    expect(connected.json()).toMatchObject({ scope: "free_busy" });
    expect(synchronized.statusCode).toBe(200);
    expect(read.json()).toEqual(availability);
    expect(disconnected.statusCode).toBe(204);
    expect(crossUser.statusCode).toBe(404);
  });

  it("rejects malformed state and out-of-range calendar input", async () => {
    const app = createApp();
    const emptyState = await app.inject({
      method: "PUT",
      url: `/v1/briefing-items/${itemId}/state`,
      headers: { authorization: "Bearer alice-token" },
      payload: {},
    });
    const privateCalendarData = await app.inject({
      method: "POST",
      url: `/v1/calendar/connections/${connectionId}/availability`,
      headers: { authorization: "Bearer alice-token" },
      payload: {
        timezone: "UTC",
        rangeStartsAt: now,
        rangeEndsAt: "2026-07-25T21:00:00.000Z",
        busyWindows: [],
        eventTitles: ["Private meeting"],
      },
    });

    expect(emptyState.statusCode).toBe(400);
    expect(privateCalendarData.statusCode).toBe(400);
    expect(privateCalendarData.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("requires authentication for library and calendar data", async () => {
    const app = createApp();
    const library = await app.inject({
      method: "GET",
      url: "/v1/library/saved",
    });
    const calendar = await app.inject({
      method: "GET",
      url: "/v1/calendar/availability",
    });

    expect(library.statusCode).toBe(401);
    expect(calendar.statusCode).toBe(401);
  });
});

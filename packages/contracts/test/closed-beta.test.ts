import { describe, expect, it } from "vitest";

import {
  ListInterestsQuerySchema,
  SyncCalendarAvailabilitySchema,
  UpdateBriefingItemStateSchema,
  UpdateUserInterestSchema,
} from "../src/index.js";

describe("closed-beta contracts", () => {
  it("supports interest content edits and explicit active filtering", () => {
    expect(
      UpdateUserInterestSchema.parse({
        name: "Major climate research",
        description: "Material research and policy changes",
        active: false,
      }),
    ).toEqual({
      name: "Major climate research",
      description: "Material research and policy changes",
      active: false,
    });
    expect(ListInterestsQuerySchema.parse({ active: "false" })).toMatchObject({
      active: false,
    });
  });

  it("requires a Saved or Later state transition", () => {
    expect(() => UpdateBriefingItemStateSchema.parse({})).toThrow();
    expect(
      UpdateBriefingItemStateSchema.parse({
        saved: true,
        deferred: false,
      }),
    ).toEqual({ saved: true, deferred: false });
  });

  it("accepts only free/busy windows inside a seven-day range", () => {
    expect(
      SyncCalendarAvailabilitySchema.parse({
        timezone: "America/Los_Angeles",
        rangeStartsAt: "2026-07-25T17:00:00.000Z",
        rangeEndsAt: "2026-07-27T17:00:00.000Z",
        busyWindows: [
          {
            startsAt: "2026-07-25T18:00:00.000Z",
            endsAt: "2026-07-25T18:30:00.000Z",
          },
        ],
      }),
    ).toMatchObject({
      timezone: "America/Los_Angeles",
      busyWindows: [{ startsAt: "2026-07-25T18:00:00.000Z" }],
    });
    expect(() =>
      SyncCalendarAvailabilitySchema.parse({
        timezone: "UTC",
        rangeStartsAt: "2026-07-25T17:00:00.000Z",
        rangeEndsAt: "2026-08-02T17:00:00.000Z",
        busyWindows: [],
      }),
    ).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import {
  findCalendarSuggestion,
  mergeBusyWindows,
} from "../src/calendar-availability.js";

describe("calendar availability", () => {
  it("merges overlapping and adjacent busy windows", () => {
    expect(
      mergeBusyWindows([
        {
          startsAt: "2026-07-25T17:30:00.000Z",
          endsAt: "2026-07-25T18:00:00.000Z",
        },
        {
          startsAt: "2026-07-25T17:00:00.000Z",
          endsAt: "2026-07-25T17:30:00.000Z",
        },
        {
          startsAt: "2026-07-25T17:45:00.000Z",
          endsAt: "2026-07-25T18:15:00.000Z",
        },
      ]),
    ).toEqual([
      {
        startsAt: "2026-07-25T17:00:00.000Z",
        endsAt: "2026-07-25T18:15:00.000Z",
      },
    ]);
  });

  it("offers the first qualifying window after current busy time", () => {
    expect(
      findCalendarSuggestion({
        now: "2026-07-25T17:10:00.000Z",
        rangeStartsAt: "2026-07-25T17:00:00.000Z",
        rangeEndsAt: "2026-07-25T20:00:00.000Z",
        busyWindows: [
          {
            startsAt: "2026-07-25T17:00:00.000Z",
            endsAt: "2026-07-25T17:30:00.000Z",
          },
          {
            startsAt: "2026-07-25T17:38:00.000Z",
            endsAt: "2026-07-25T18:00:00.000Z",
          },
          {
            startsAt: "2026-07-25T18:23:00.000Z",
            endsAt: "2026-07-25T18:45:00.000Z",
          },
        ],
        minimumMinutes: 10,
        defaultBriefingMinutes: 10,
      }),
    ).toEqual({
      startsAt: "2026-07-25T18:00:00.000Z",
      endsAt: "2026-07-25T18:23:00.000Z",
      availableMinutes: 23,
      suggestedBriefingMinutes: 10,
    });
  });

  it("does not suggest a window when the range is exhausted", () => {
    expect(
      findCalendarSuggestion({
        now: "2026-07-25T20:00:00.000Z",
        rangeStartsAt: "2026-07-25T17:00:00.000Z",
        rangeEndsAt: "2026-07-25T20:00:00.000Z",
        busyWindows: [],
        minimumMinutes: 2,
        defaultBriefingMinutes: 5,
      }),
    ).toBeNull();
  });
});

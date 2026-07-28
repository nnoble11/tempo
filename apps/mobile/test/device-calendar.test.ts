import { describe, expect, it } from "vitest";

import { calendarErrorMessage } from "../src/features/calendar/calendar-errors.js";
import {
  buildDeviceCalendarAvailability,
  normalizeDeviceBusyWindows,
  type DeviceCalendarEventTime,
} from "../src/features/calendar/calendar-windows.js";

const rangeStartsAt = new Date("2026-07-27T17:00:00.000Z");
const rangeEndsAt = new Date("2026-07-29T17:00:00.000Z");

const event = (
  overrides: Partial<DeviceCalendarEventTime>,
): DeviceCalendarEventTime => ({
  allDay: false,
  availability: "busy",
  endDate: "2026-07-27T18:00:00.000Z",
  startDate: "2026-07-27T17:30:00.000Z",
  status: "confirmed",
  ...overrides,
});

describe("device calendar availability", () => {
  it("clips, merges, and orders busy events before upload", () => {
    expect(
      normalizeDeviceBusyWindows(
        [
          event({
            startDate: "2026-07-27T17:50:00.000Z",
            endDate: "2026-07-27T18:30:00.000Z",
          }),
          event({
            startDate: "2026-07-27T16:30:00.000Z",
            endDate: "2026-07-27T17:45:00.000Z",
          }),
          event({
            startDate: "2026-07-28T19:00:00.000Z",
            endDate: "2026-07-28T19:15:00.000Z",
          }),
        ],
        rangeStartsAt,
        rangeEndsAt,
      ),
    ).toEqual([
      {
        startsAt: "2026-07-27T17:00:00.000Z",
        endsAt: "2026-07-27T17:45:00.000Z",
      },
      {
        startsAt: "2026-07-27T17:50:00.000Z",
        endsAt: "2026-07-27T18:30:00.000Z",
      },
      {
        startsAt: "2026-07-28T19:00:00.000Z",
        endsAt: "2026-07-28T19:15:00.000Z",
      },
    ]);
  });

  it("does not upload free, all-day, canceled, invalid, or out-of-range events", () => {
    expect(
      normalizeDeviceBusyWindows(
        [
          event({ availability: "free" }),
          event({ allDay: true }),
          event({ status: "canceled" }),
          event({ startDate: "not-a-date" }),
          event({
            startDate: "2026-07-30T17:30:00.000Z",
            endDate: "2026-07-30T18:00:00.000Z",
          }),
        ],
        rangeStartsAt,
        rangeEndsAt,
      ),
    ).toEqual([]);
  });

  it("merges a high event count before enforcing the API limit", () => {
    const availability = buildDeviceCalendarAvailability({
      events: Array.from({ length: 501 }, () => event({})),
      rangeStartsAt,
      rangeEndsAt,
      timezone: "America/Los_Angeles",
    });

    expect(availability.busyWindows).toHaveLength(1);
    expect(availability.timezone).toBe("America/Los_Angeles");
  });

  it("explains when the connected API does not support calendar routes", () => {
    expect(
      calendarErrorMessage(
        { status: 404 },
        "Tempo could not load calendar availability.",
      ),
    ).toContain("service is updated");
  });
});

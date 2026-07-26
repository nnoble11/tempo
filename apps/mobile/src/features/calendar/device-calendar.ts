import * as Calendar from "expo-calendar";

import type { SyncCalendarAvailability } from "@tempo/contracts";

export type DeviceCalendarAvailabilityResult =
  | { status: "denied" }
  | { status: "granted"; availability: SyncCalendarAvailability };

export const readDeviceCalendarAvailability =
  async (): Promise<DeviceCalendarAvailabilityResult> => {
    const current = await Calendar.getCalendarPermissions();
    const permission = current.granted
      ? current
      : await Calendar.requestCalendarPermissions();
    if (!permission.granted) {
      return { status: "denied" };
    }

    const rangeStartsAt = new Date();
    const rangeEndsAt = new Date(rangeStartsAt.valueOf() + 48 * 60 * 60_000);
    const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
    const events = await Calendar.listEvents(
      calendars,
      rangeStartsAt,
      rangeEndsAt,
    );
    const busyWindows = events
      .filter(
        (event) =>
          event.availability !== Calendar.Availability.FREE && !event.allDay,
      )
      .map((event) => ({
        startsAt: new Date(event.startDate).toISOString(),
        endsAt: new Date(event.endDate).toISOString(),
      }))
      .filter(
        ({ startsAt, endsAt }) =>
          new Date(startsAt) < new Date(endsAt) &&
          new Date(endsAt) > rangeStartsAt &&
          new Date(startsAt) < rangeEndsAt,
      )
      .map(({ startsAt, endsAt }) => ({
        startsAt: new Date(
          Math.max(new Date(startsAt).valueOf(), rangeStartsAt.valueOf()),
        ).toISOString(),
        endsAt: new Date(
          Math.min(new Date(endsAt).valueOf(), rangeEndsAt.valueOf()),
        ).toISOString(),
      }));

    return {
      status: "granted",
      availability: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        rangeStartsAt: rangeStartsAt.toISOString(),
        rangeEndsAt: rangeEndsAt.toISOString(),
        busyWindows,
      },
    };
  };

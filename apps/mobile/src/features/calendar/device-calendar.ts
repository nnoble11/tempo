import * as Calendar from "expo-calendar";

import type { SyncCalendarAvailability } from "@tempo/contracts";

import { buildDeviceCalendarAvailability } from "./calendar-windows";

export type DeviceCalendarAvailabilityResult =
  | { status: "denied"; canAskAgain: boolean }
  | { status: "granted"; availability: SyncCalendarAvailability };

export const readDeviceCalendarAvailability =
  async (): Promise<DeviceCalendarAvailabilityResult> => {
    const current = await Calendar.getCalendarPermissions(false);
    const permission = current.granted
      ? current
      : current.canAskAgain
        ? await Calendar.requestCalendarPermissions(false)
        : current;
    if (!permission.granted) {
      return { status: "denied", canAskAgain: permission.canAskAgain };
    }

    const rangeStartsAt = new Date();
    const rangeEndsAt = new Date(rangeStartsAt.valueOf() + 48 * 60 * 60_000);
    const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
    const events = await Calendar.listEvents(
      calendars,
      rangeStartsAt,
      rangeEndsAt,
    );

    return {
      status: "granted",
      availability: buildDeviceCalendarAvailability({
        events,
        rangeStartsAt,
        rangeEndsAt,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone.trim() || "UTC",
      }),
    };
  };

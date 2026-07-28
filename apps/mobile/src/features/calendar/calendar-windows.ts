import {
  SyncCalendarAvailabilitySchema,
  type CalendarBusyWindow,
  type SyncCalendarAvailability,
} from "@tempo/contracts";

export type DeviceCalendarEventTime = {
  allDay: boolean;
  availability: string;
  endDate: Date | string;
  startDate: Date | string;
  status: string;
};

const eventTimestamp = (value: Date | string): number =>
  value instanceof Date ? value.valueOf() : new Date(value).valueOf();

export const normalizeDeviceBusyWindows = (
  events: readonly DeviceCalendarEventTime[],
  rangeStartsAt: Date,
  rangeEndsAt: Date,
): CalendarBusyWindow[] => {
  const rangeStart = rangeStartsAt.valueOf();
  const rangeEnd = rangeEndsAt.valueOf();
  const clipped = events
    .filter(
      (event) =>
        !event.allDay &&
        event.availability !== "free" &&
        event.status !== "canceled",
    )
    .map((event) => ({
      startsAt: Math.max(eventTimestamp(event.startDate), rangeStart),
      endsAt: Math.min(eventTimestamp(event.endDate), rangeEnd),
    }))
    .filter(
      (window) =>
        Number.isFinite(window.startsAt) &&
        Number.isFinite(window.endsAt) &&
        window.startsAt < window.endsAt,
    )
    .sort((left, right) => left.startsAt - right.startsAt);

  const merged: { startsAt: number; endsAt: number }[] = [];
  for (const window of clipped) {
    const previous = merged.at(-1);
    if (previous === undefined || window.startsAt > previous.endsAt) {
      merged.push(window);
    } else if (window.endsAt > previous.endsAt) {
      previous.endsAt = window.endsAt;
    }
  }

  return merged.map((window) => ({
    startsAt: new Date(window.startsAt).toISOString(),
    endsAt: new Date(window.endsAt).toISOString(),
  }));
};

export const buildDeviceCalendarAvailability = (input: {
  events: readonly DeviceCalendarEventTime[];
  rangeStartsAt: Date;
  rangeEndsAt: Date;
  timezone: string;
}): SyncCalendarAvailability => {
  const busyWindows = normalizeDeviceBusyWindows(
    input.events,
    input.rangeStartsAt,
    input.rangeEndsAt,
  );
  if (busyWindows.length > 500) {
    throw new Error(
      "Tempo found too many separate busy periods to synchronize safely.",
    );
  }
  return SyncCalendarAvailabilitySchema.parse({
    timezone: input.timezone,
    rangeStartsAt: input.rangeStartsAt.toISOString(),
    rangeEndsAt: input.rangeEndsAt.toISOString(),
    busyWindows,
  });
};

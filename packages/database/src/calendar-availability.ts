import type { CalendarBusyWindow, CalendarSuggestion } from "@tempo/contracts";

export const mergeBusyWindows = (
  windows: readonly CalendarBusyWindow[],
): CalendarBusyWindow[] => {
  const sorted = windows
    .map((window) => ({
      startsAt: new Date(window.startsAt),
      endsAt: new Date(window.endsAt),
    }))
    .sort((left, right) => left.startsAt.valueOf() - right.startsAt.valueOf());
  const merged: { startsAt: Date; endsAt: Date }[] = [];
  for (const window of sorted) {
    const previous = merged.at(-1);
    if (previous === undefined || window.startsAt > previous.endsAt) {
      merged.push(window);
    } else if (window.endsAt > previous.endsAt) {
      previous.endsAt = window.endsAt;
    }
  }
  return merged.map(({ startsAt, endsAt }) => ({
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  }));
};

export const findCalendarSuggestion = (input: {
  now: string;
  rangeStartsAt: string;
  rangeEndsAt: string;
  busyWindows: readonly CalendarBusyWindow[];
  minimumMinutes: number;
  defaultBriefingMinutes: number;
}): CalendarSuggestion | null => {
  const rangeEnd = new Date(input.rangeEndsAt);
  let candidate = new Date(
    Math.max(
      new Date(input.now).valueOf(),
      new Date(input.rangeStartsAt).valueOf(),
    ),
  );
  if (candidate >= rangeEnd) {
    return null;
  }

  const windows = mergeBusyWindows(input.busyWindows);
  for (const window of [
    ...windows,
    {
      startsAt: rangeEnd.toISOString(),
      endsAt: rangeEnd.toISOString(),
    },
  ]) {
    const busyStart = new Date(window.startsAt);
    const busyEnd = new Date(window.endsAt);
    if (busyEnd <= candidate) {
      continue;
    }
    const freeEnd = new Date(Math.min(busyStart.valueOf(), rangeEnd.valueOf()));
    const availableMinutes = Math.floor(
      (freeEnd.valueOf() - candidate.valueOf()) / 60_000,
    );
    if (availableMinutes >= input.minimumMinutes) {
      return {
        startsAt: candidate.toISOString(),
        endsAt: freeEnd.toISOString(),
        availableMinutes,
        suggestedBriefingMinutes: Math.min(
          input.defaultBriefingMinutes,
          availableMinutes,
        ),
      };
    }
    if (busyEnd > candidate) {
      candidate = busyEnd;
    }
    if (candidate >= rangeEnd) {
      return null;
    }
  }
  return null;
};

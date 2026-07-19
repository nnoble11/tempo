const minuteOfDay = (instant: Date, timezone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = Number(parts.find(({ type }) => type === "hour")?.value);
  const minute = Number(parts.find(({ type }) => type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Cannot resolve local time in ${timezone}.`);
  }
  return hour * 60 + minute;
};

const parseTime = (value: string): number => {
  const parts = value.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Expected a 24-hour time in HH:MM format.");
  }
  return hour * 60 + minute;
};

export const isQuietTime = (
  instant: Date,
  timezone: string,
  quietHoursStart: string,
  quietHoursEnd: string,
): boolean => {
  const localMinute = minuteOfDay(instant, timezone);
  const start = parseTime(quietHoursStart);
  const end = parseTime(quietHoursEnd);
  return start < end
    ? localMinute >= start && localMinute < end
    : localMinute >= start || localMinute < end;
};

export const nextAllowedDeliveryTime = (
  scheduledFor: string,
  timezone: string,
  quietHoursStart: string | null,
  quietHoursEnd: string | null,
): string => {
  if (quietHoursStart === null || quietHoursEnd === null) {
    return new Date(scheduledFor).toISOString();
  }
  let candidate = new Date(scheduledFor);
  for (let minute = 0; minute <= 26 * 60; minute += 1) {
    if (!isQuietTime(candidate, timezone, quietHoursStart, quietHoursEnd)) {
      return candidate.toISOString();
    }
    candidate = new Date(candidate.valueOf() + 60_000);
  }
  throw new Error("Quiet hours did not produce an allowed delivery window.");
};

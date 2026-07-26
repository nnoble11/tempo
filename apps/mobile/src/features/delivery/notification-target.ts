const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const briefingIdFromNotificationData = (
  data: Record<string, unknown> | null | undefined,
): string | null => {
  const value = data?.briefingId;
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
};

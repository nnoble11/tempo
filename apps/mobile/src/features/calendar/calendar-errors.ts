type StatusBearingError = {
  message?: unknown;
  status?: unknown;
};

const hasStatus = (error: unknown): error is StatusBearingError =>
  typeof error === "object" && error !== null && "status" in error;

export const calendarErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (hasStatus(error) && error.status === 404) {
    return "Calendar is not available on the connected Tempo service yet. Try again after the service is updated.";
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

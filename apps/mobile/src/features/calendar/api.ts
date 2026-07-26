import {
  CalendarAvailabilitySchema,
  CalendarConnectionSchema,
  type CalendarAvailability,
  type CalendarConnection,
  type SyncCalendarAvailability,
} from "@tempo/contracts";

import { authenticatedRequest } from "../../api/client";

export const connectDeviceCalendar = async (): Promise<CalendarConnection> => {
  const response = await authenticatedRequest(
    "/v1/calendar/connections/device",
    {
      method: "PUT",
      body: JSON.stringify({ displayName: "This iPhone" }),
    },
  );
  return CalendarConnectionSchema.parse(await response.json());
};

export const syncCalendarAvailability = async (
  connectionId: string,
  input: SyncCalendarAvailability,
): Promise<CalendarConnection> => {
  const response = await authenticatedRequest(
    `/v1/calendar/connections/${connectionId}/availability`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return CalendarConnectionSchema.parse(await response.json());
};

export const fetchCalendarAvailability =
  async (): Promise<CalendarAvailability> => {
    const now = encodeURIComponent(new Date().toISOString());
    const response = await authenticatedRequest(
      `/v1/calendar/availability?minimumMinutes=2&now=${now}`,
    );
    return CalendarAvailabilitySchema.parse(await response.json());
  };

export const disconnectCalendar = async (
  connectionId: string,
): Promise<void> => {
  await authenticatedRequest(`/v1/calendar/connections/${connectionId}`, {
    method: "DELETE",
  });
};

import { z } from "zod";

export const CalendarConnectionSchema = z
  .object({
    id: z.uuid(),
    provider: z.literal("device"),
    displayName: z.string().trim().min(1).max(100),
    scope: z.literal("free_busy"),
    active: z.boolean(),
    lastSyncedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const ConnectDeviceCalendarSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).default("This device"),
  })
  .strict();

export const CalendarBusyWindowSchema = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    ({ startsAt, endsAt }) => new Date(startsAt) < new Date(endsAt),
    "Busy-window end must be later than its start",
  );

export const SyncCalendarAvailabilitySchema = z
  .object({
    timezone: z.string().trim().min(1).max(100),
    rangeStartsAt: z.iso.datetime(),
    rangeEndsAt: z.iso.datetime(),
    busyWindows: z.array(CalendarBusyWindowSchema).max(500),
  })
  .strict()
  .superRefine((input, context) => {
    const start = new Date(input.rangeStartsAt);
    const end = new Date(input.rangeEndsAt);
    if (start >= end || end.valueOf() - start.valueOf() > 7 * 86_400_000) {
      context.addIssue({
        code: "custom",
        message:
          "Availability range must be positive and no longer than 7 days",
        path: ["rangeEndsAt"],
      });
    }
    input.busyWindows.forEach((window, index) => {
      if (new Date(window.startsAt) < start || new Date(window.endsAt) > end) {
        context.addIssue({
          code: "custom",
          message: "Busy windows must stay within the synchronized range",
          path: ["busyWindows", index],
        });
      }
    });
  });

export const CalendarAvailabilityQuerySchema = z
  .object({
    minimumMinutes: z.coerce.number().int().min(2).max(60).default(2),
    now: z.iso.datetime().optional(),
  })
  .strict();

export const CalendarSuggestionSchema = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    availableMinutes: z.number().int().min(2),
    suggestedBriefingMinutes: z.number().int().min(1).max(60),
  })
  .strict();

export const CalendarAvailabilitySchema = z
  .object({
    connection: CalendarConnectionSchema.nullable(),
    suggestion: CalendarSuggestionSchema.nullable(),
    rangeStartsAt: z.iso.datetime().nullable(),
    rangeEndsAt: z.iso.datetime().nullable(),
  })
  .strict();

export type CalendarConnection = z.infer<typeof CalendarConnectionSchema>;
export type ConnectDeviceCalendar = z.infer<typeof ConnectDeviceCalendarSchema>;
export type CalendarBusyWindow = z.infer<typeof CalendarBusyWindowSchema>;
export type SyncCalendarAvailability = z.infer<
  typeof SyncCalendarAvailabilitySchema
>;
export type CalendarAvailabilityQuery = z.infer<
  typeof CalendarAvailabilityQuerySchema
>;
export type CalendarSuggestion = z.infer<typeof CalendarSuggestionSchema>;
export type CalendarAvailability = z.infer<typeof CalendarAvailabilitySchema>;

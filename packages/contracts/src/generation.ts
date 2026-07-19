import { z } from "zod";

export const ScheduledBriefingRunStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "skipped",
  "failed",
]);

export const ScheduledBriefingRunSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    localDate: z.iso.date(),
    scheduledFor: z.iso.datetime(),
    status: ScheduledBriefingRunStatusSchema,
    attemptCount: z.number().int().nonnegative(),
    candidateCount: z.number().int().nonnegative(),
    selectedCount: z.number().int().nonnegative(),
    briefingId: z.uuid().nullable(),
    workerId: z.string().min(1).max(200).nullable(),
    leaseExpiresAt: z.iso.datetime().nullable(),
    nextAttemptAt: z.iso.datetime().nullable(),
    lastError: z.string().max(2_000).nullable(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type ScheduledBriefingRunStatus = z.infer<
  typeof ScheduledBriefingRunStatusSchema
>;
export type ScheduledBriefingRun = z.infer<typeof ScheduledBriefingRunSchema>;

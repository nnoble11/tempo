import { z } from "zod";

import { CanonicalBriefingItemSchema } from "./canonical-briefing.js";

export const BriefingSummarySchema = z
  .object({
    id: z.uuid(),
    scheduledFor: z.iso.datetime(),
    generatedAt: z.iso.datetime(),
    status: z.enum(["ready", "delivered", "archived"]),
    overview: z.string().trim().min(1).max(2_000),
    targetMinutes: z.number().int().min(1).max(60),
    estimatedSeconds: z.number().int().positive(),
    itemCount: z.number().int().nonnegative(),
  })
  .strict();

export const LibraryPageQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.uuid().optional(),
  })
  .strict();

export const BriefingHistoryPageSchema = z
  .object({
    items: z.array(BriefingSummarySchema),
    nextCursor: z.uuid().nullable(),
  })
  .strict();

export const UpdateBriefingItemStateSchema = z
  .object({
    saved: z.boolean().optional(),
    deferred: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.saved !== undefined || value.deferred !== undefined,
    "At least one item state must be provided",
  );

export const BriefingItemStateSchema = z
  .object({
    id: z.uuid(),
    briefingItemId: z.uuid(),
    savedAt: z.iso.datetime().nullable(),
    deferredAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const BriefingItemStateListSchema = z
  .object({
    items: z.array(BriefingItemStateSchema),
  })
  .strict();

export const LibraryItemSchema = z
  .object({
    state: BriefingItemStateSchema,
    briefing: BriefingSummarySchema,
    item: CanonicalBriefingItemSchema,
  })
  .strict();

export const LibraryItemPageSchema = z
  .object({
    items: z.array(LibraryItemSchema),
    nextCursor: z.uuid().nullable(),
  })
  .strict();

export type BriefingSummary = z.infer<typeof BriefingSummarySchema>;
export type LibraryPageQuery = z.infer<typeof LibraryPageQuerySchema>;
export type BriefingHistoryPage = z.infer<typeof BriefingHistoryPageSchema>;
export type UpdateBriefingItemState = z.infer<
  typeof UpdateBriefingItemStateSchema
>;
export type BriefingItemState = z.infer<typeof BriefingItemStateSchema>;
export type LibraryItem = z.infer<typeof LibraryItemSchema>;
export type LibraryItemPage = z.infer<typeof LibraryItemPageSchema>;

import { z } from "zod";

const LanguageCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);

export const SourceAdapterKindSchema = z.enum(["rss", "atom", "json_api"]);

export const SourceRegistrationSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1).max(200),
    homepageUrl: z.url(),
    feedUrl: z.url(),
    adapterKind: SourceAdapterKindSchema,
    defaultLanguage: LanguageCodeSchema,
    fetchIntervalMinutes: z.number().int().min(5).max(1_440),
  })
  .strict();

export const SourceSchema = SourceRegistrationSchema.extend({
  id: z.uuid(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();

export const NormalizedSourceItemSchema = z
  .object({
    sourceKey: SourceRegistrationSchema.shape.key,
    externalId: z.string().trim().min(1).max(1_000),
    canonicalUrl: z.url(),
    title: z.string().trim().min(1).max(1_000),
    author: z.string().trim().min(1).max(500).nullable(),
    publishedAt: z.iso.datetime().nullable(),
    discoveredAt: z.iso.datetime(),
    language: LanguageCodeSchema,
    excerpt: z.string().trim().min(1).max(10_000).nullable(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    metadata: z.record(z.string(), z.unknown()),
  })
  .strict();

export const StoredSourceItemSchema = NormalizedSourceItemSchema.extend({
  id: z.uuid(),
  sourceId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();

export const SourceItemUpsertResultSchema = z
  .object({
    inserted: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
  })
  .strict();

export type SourceRegistration = z.infer<typeof SourceRegistrationSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type NormalizedSourceItem = z.infer<typeof NormalizedSourceItemSchema>;
export type StoredSourceItem = z.infer<typeof StoredSourceItemSchema>;
export type SourceItemUpsertResult = z.infer<
  typeof SourceItemUpsertResultSchema
>;

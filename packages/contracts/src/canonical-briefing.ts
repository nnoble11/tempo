import { z } from "zod";

import { RankingComponentsSchema, RankingResultSchema } from "./ranking.js";
import {
  CitationSupportTypeSchema,
  ClaimKindSchema,
  StoryIntelligenceSchema,
} from "./story.js";

export const BriefingStatusSchema = z.enum(["ready", "delivered", "archived"]);

export const BriefingCitationSnapshotSchema = z
  .object({
    citationId: z.uuid(),
    sourceItemId: z.uuid(),
    canonicalUrl: z.url(),
    sourceTitle: z.string().trim().min(1).max(1_000),
    publisher: z.string().trim().min(1).max(200),
    publishedAt: z.iso.datetime().nullable(),
    supportType: CitationSupportTypeSchema,
    supportingText: z.string().trim().min(1).max(2_000).nullable(),
  })
  .strict();

export const BriefingClaimSnapshotSchema = z
  .object({
    claimId: z.uuid(),
    key: z.string().trim().min(1).max(200),
    kind: ClaimKindSchema,
    text: z.string().trim().min(1).max(2_000),
    confidence: z.number().min(0).max(1),
    isContested: z.boolean(),
    citations: z.array(BriefingCitationSnapshotSchema).min(1).max(20),
  })
  .strict();

const CanonicalBriefingItemDraftBaseSchema = z
  .object({
    storyClusterId: z.uuid(),
    candidateUpdateId: z.uuid(),
    userInterestId: z.uuid(),
    position: z.number().int().positive(),
    headline: z.string().trim().min(1).max(300),
    takeaway: z.string().trim().min(1).max(2_000),
    whyItMatters: z.string().trim().min(1).max(2_000),
    whatChanged: z.string().trim().min(1).max(2_000),
    estimatedSeconds: z.number().int().min(15).max(3_600),
    ranking: RankingResultSchema,
    claims: z.array(BriefingClaimSnapshotSchema).min(1).max(50),
  })
  .strict();

export const CanonicalBriefingItemDraftSchema =
  CanonicalBriefingItemDraftBaseSchema.superRefine((item, context) => {
    const claimIds = item.claims.map(({ claimId }) => claimId);
    if (new Set(claimIds).size !== claimIds.length) {
      context.addIssue({
        code: "custom",
        message: "Briefing item claim snapshots must be unique",
        path: ["claims"],
      });
    }
  });

const CanonicalBriefingDraftBaseSchema = z
  .object({
    targetMinutes: z.number().int().min(1).max(60),
    actualWordCount: z.number().int().nonnegative(),
    estimatedSeconds: z.number().int().positive(),
    scheduledFor: z.iso.datetime(),
    generatedAt: z.iso.datetime(),
    status: BriefingStatusSchema,
    overview: z.string().trim().min(1).max(2_000),
    promptVersion: z.string().trim().min(1).max(200),
    modelVersion: z.string().trim().min(1).max(200),
    items: z.array(CanonicalBriefingItemDraftSchema).min(1).max(100),
  })
  .strict();

export const CanonicalBriefingDraftSchema =
  CanonicalBriefingDraftBaseSchema.superRefine((briefing, context) => {
    const positions = briefing.items.map(({ position }) => position);
    const expectedPositions = briefing.items.map((_, index) => index + 1);
    if (
      positions.length !== expectedPositions.length ||
      positions.some((position, index) => position !== expectedPositions[index])
    ) {
      context.addIssue({
        code: "custom",
        message: "Briefing item positions must be contiguous and one-based",
        path: ["items"],
      });
    }
    const clusterIds = briefing.items.map(
      ({ storyClusterId }) => storyClusterId,
    );
    if (new Set(clusterIds).size !== clusterIds.length) {
      context.addIssue({
        code: "custom",
        message: "A briefing may contain only one item per story cluster",
        path: ["items"],
      });
    }
    if (briefing.estimatedSeconds > briefing.targetMinutes * 60) {
      context.addIssue({
        code: "custom",
        message: "Briefing estimated time exceeds its target duration",
        path: ["estimatedSeconds"],
      });
    }
  });

export const CanonicalBriefingItemSchema =
  CanonicalBriefingItemDraftBaseSchema.extend({
    id: z.uuid(),
    briefingId: z.uuid(),
    createdAt: z.iso.datetime(),
  }).strict();

export const CanonicalBriefingSchema = CanonicalBriefingDraftBaseSchema.omit({
  items: true,
})
  .extend({
    id: z.uuid(),
    userId: z.uuid(),
    items: z.array(CanonicalBriefingItemSchema).min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const SaveCanonicalBriefingCommandSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(200),
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
    briefing: CanonicalBriefingDraftSchema,
  })
  .strict();

export const TodayBriefingResponseSchema = z
  .object({
    briefing: CanonicalBriefingSchema.nullable(),
  })
  .strict();

export const BriefingInteractionEventSchema = z.enum([
  "opened",
  "expanded",
  "saved",
  "source_clicked",
  "useful",
  "not_useful",
  "dismissed",
  "deferred",
]);

export const CreateBriefingInteractionSchema = z
  .object({
    eventType: BriefingInteractionEventSchema,
    value: z.record(z.string(), z.unknown()).default({}),
    occurredAt: z.iso.datetime().optional(),
    idempotencyKey: z.string().trim().min(1).max(200),
  })
  .strict();

export const BriefingInteractionSchema = CreateBriefingInteractionSchema.omit({
  occurredAt: true,
})
  .extend({
    id: z.uuid(),
    userId: z.uuid(),
    briefingItemId: z.uuid(),
    occurredAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const GroundedBriefingCandidateContextSchema = z
  .object({
    story: StoryIntelligenceSchema,
    userInterestId: z.uuid(),
    whyItMatters: z.string().trim().min(1).max(2_000),
    rankingComponents: RankingComponentsSchema,
  })
  .strict();

export const GroundedBriefingGenerationRequestSchema = z
  .object({
    targetMinutes: z.number().int().min(1).max(60),
    scheduledFor: z.iso.datetime(),
    generatedAt: z.iso.datetime(),
    overview: z.string().trim().min(1).max(2_000),
    promptVersion: z.string().trim().min(1).max(200),
    modelVersion: z.string().trim().min(1).max(200),
    candidates: z.array(GroundedBriefingCandidateContextSchema).min(1).max(200),
  })
  .strict()
  .superRefine((request, context) => {
    const candidateIds = request.candidates.map(
      ({ story }) => story.candidate.id,
    );
    if (new Set(candidateIds).size !== candidateIds.length) {
      context.addIssue({
        code: "custom",
        message: "Generation candidates must be unique",
        path: ["candidates"],
      });
    }
  });

export type BriefingCitationSnapshot = z.infer<
  typeof BriefingCitationSnapshotSchema
>;
export type BriefingClaimSnapshot = z.infer<typeof BriefingClaimSnapshotSchema>;
export type CanonicalBriefingItemDraft = z.infer<
  typeof CanonicalBriefingItemDraftSchema
>;
export type CanonicalBriefingDraft = z.infer<
  typeof CanonicalBriefingDraftSchema
>;
export type CanonicalBriefingItem = z.infer<typeof CanonicalBriefingItemSchema>;
export type CanonicalBriefing = z.infer<typeof CanonicalBriefingSchema>;
export type SaveCanonicalBriefingCommand = z.infer<
  typeof SaveCanonicalBriefingCommandSchema
>;
export type TodayBriefingResponse = z.infer<typeof TodayBriefingResponseSchema>;
export type CreateBriefingInteraction = z.infer<
  typeof CreateBriefingInteractionSchema
>;
export type BriefingInteraction = z.infer<typeof BriefingInteractionSchema>;
export type GroundedBriefingCandidateContext = z.infer<
  typeof GroundedBriefingCandidateContextSchema
>;
export type GroundedBriefingGenerationRequest = z.infer<
  typeof GroundedBriefingGenerationRequestSchema
>;

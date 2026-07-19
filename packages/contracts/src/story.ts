import { z } from "zod";

const ScoreSchema = z.number().min(0).max(1);
const IdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const StoryClusterStatusSchema = z.enum([
  "active",
  "superseded",
  "archived",
]);

export const StoryClusterSourceDraftSchema = z
  .object({
    sourceItemId: z.uuid(),
    membershipScore: ScoreSchema,
    isPrimary: z.boolean(),
  })
  .strict();

const StoryClusterDraftBaseSchema = z
  .object({
    deduplicationKey: IdentifierSchema,
    canonicalTitle: z.string().trim().min(1).max(500),
    summary: z.string().trim().min(1).max(5_000).nullable(),
    firstSeenAt: z.iso.datetime(),
    lastUpdatedAt: z.iso.datetime(),
    status: StoryClusterStatusSchema,
    sourceItems: z.array(StoryClusterSourceDraftSchema).min(1).max(100),
  })
  .strict();

export const StoryClusterDraftSchema = StoryClusterDraftBaseSchema.superRefine(
  (cluster, context) => {
    const sourceItemIds = cluster.sourceItems.map(
      ({ sourceItemId }) => sourceItemId,
    );
    if (new Set(sourceItemIds).size !== sourceItemIds.length) {
      context.addIssue({
        code: "custom",
        message: "sourceItems must not contain duplicates",
        path: ["sourceItems"],
      });
    }
    if (cluster.sourceItems.filter(({ isPrimary }) => isPrimary).length !== 1) {
      context.addIssue({
        code: "custom",
        message: "A story cluster must have exactly one primary source item",
        path: ["sourceItems"],
      });
    }
    if (new Date(cluster.lastUpdatedAt) < new Date(cluster.firstSeenAt)) {
      context.addIssue({
        code: "custom",
        message: "lastUpdatedAt must not precede firstSeenAt",
        path: ["lastUpdatedAt"],
      });
    }
  },
);

export const ClaimKindSchema = z.enum([
  "source_fact",
  "reported_claim",
  "inference",
]);

export const CitationSupportTypeSchema = z.enum([
  "direct",
  "context",
  "contradiction",
]);

export const GroundedCitationDraftSchema = z
  .object({
    sourceItemId: z.uuid(),
    supportType: CitationSupportTypeSchema,
    supportingText: z.string().trim().min(1).max(2_000).nullable(),
  })
  .strict();

const GroundedClaimDraftBaseSchema = z
  .object({
    key: IdentifierSchema,
    kind: ClaimKindSchema,
    text: z.string().trim().min(1).max(2_000),
    confidence: ScoreSchema,
    isContested: z.boolean(),
    citations: z.array(GroundedCitationDraftSchema).min(1).max(20),
  })
  .strict();

export const GroundedClaimDraftSchema =
  GroundedClaimDraftBaseSchema.superRefine((claim, context) => {
    const sourceItemIds = claim.citations.map(
      ({ sourceItemId }) => sourceItemId,
    );
    if (new Set(sourceItemIds).size !== sourceItemIds.length) {
      context.addIssue({
        code: "custom",
        message: "A claim may cite a source item only once",
        path: ["citations"],
      });
    }
    if (
      claim.kind !== "inference" &&
      !claim.citations.some(({ supportType }) => supportType === "direct")
    ) {
      context.addIssue({
        code: "custom",
        message: "Source facts and reported claims require direct support",
        path: ["citations"],
      });
    }
    if (
      !claim.citations.some(
        ({ supportType }) => supportType !== "contradiction",
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Every claim requires at least one supporting citation",
        path: ["citations"],
      });
    }
  });

export const CandidateBaselineScoresSchema = z
  .object({
    globalImportance: ScoreSchema,
    novelty: ScoreSchema,
    urgency: ScoreSchema,
    credibility: ScoreSchema,
    sourceDiversity: ScoreSchema,
    recency: ScoreSchema,
    clickbaitPenalty: ScoreSchema,
    confidence: ScoreSchema,
  })
  .strict();

const ReusableCandidateDraftBaseSchema = z
  .object({
    key: IdentifierSchema,
    headline: z.string().trim().min(1).max(300),
    takeaway: z.string().trim().min(1).max(2_000),
    whatChanged: z.string().trim().min(1).max(2_000),
    estimatedSeconds: z.number().int().min(15).max(3_600),
    language: z.string().trim().min(2).max(35),
    contentClass: z.literal("editorial"),
    status: z.enum(["draft", "ready", "retired"]),
    baselineScores: CandidateBaselineScoresSchema,
    claimKeys: z.array(IdentifierSchema).min(1).max(50),
    promptVersion: z.string().trim().min(1).max(200).nullable(),
    modelVersion: z.string().trim().min(1).max(200).nullable(),
  })
  .strict();

export const ReusableCandidateDraftSchema =
  ReusableCandidateDraftBaseSchema.superRefine((candidate, context) => {
    if (new Set(candidate.claimKeys).size !== candidate.claimKeys.length) {
      context.addIssue({
        code: "custom",
        message: "claimKeys must not contain duplicates",
        path: ["claimKeys"],
      });
    }
  });

export const StoryIntelligenceDraftSchema = z
  .object({
    cluster: StoryClusterDraftSchema,
    claims: z.array(GroundedClaimDraftSchema).min(1).max(100),
    candidate: ReusableCandidateDraftSchema,
  })
  .strict()
  .superRefine((story, context) => {
    const claimKeys = story.claims.map(({ key }) => key);
    if (new Set(claimKeys).size !== claimKeys.length) {
      context.addIssue({
        code: "custom",
        message: "Claim keys must be unique within a story",
        path: ["claims"],
      });
    }

    const sourceItemIds = new Set(
      story.cluster.sourceItems.map(({ sourceItemId }) => sourceItemId),
    );
    story.claims.forEach((claim, claimIndex) => {
      claim.citations.forEach((citation, citationIndex) => {
        if (!sourceItemIds.has(citation.sourceItemId)) {
          context.addIssue({
            code: "custom",
            message: "Claim citations must belong to the story cluster",
            path: [
              "claims",
              claimIndex,
              "citations",
              citationIndex,
              "sourceItemId",
            ],
          });
        }
      });
    });

    const knownClaimKeys = new Set(claimKeys);
    story.candidate.claimKeys.forEach((claimKey, claimIndex) => {
      if (!knownClaimKeys.has(claimKey)) {
        context.addIssue({
          code: "custom",
          message: "Candidate claimKeys must reference claims in the story",
          path: ["candidate", "claimKeys", claimIndex],
        });
      }
    });
  });

export const StoredStoryClusterSourceSchema =
  StoryClusterSourceDraftSchema.extend({
    canonicalUrl: z.url(),
    sourceTitle: z.string().trim().min(1).max(1_000),
    publisher: z.string().trim().min(1).max(200),
    publishedAt: z.iso.datetime().nullable(),
  }).strict();

export const StoredStoryClusterSchema = StoryClusterDraftBaseSchema.omit({
  sourceItems: true,
})
  .extend({
    id: z.uuid(),
    sourceItems: z.array(StoredStoryClusterSourceSchema).min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const GroundedCitationSchema = GroundedCitationDraftSchema.extend({
  id: z.uuid(),
  canonicalUrl: z.url(),
  sourceTitle: z.string().trim().min(1).max(1_000),
  publisher: z.string().trim().min(1).max(200),
  publishedAt: z.iso.datetime().nullable(),
}).strict();

export const GroundedClaimSchema = GroundedClaimDraftBaseSchema.omit({
  citations: true,
})
  .extend({
    id: z.uuid(),
    clusterId: z.uuid(),
    citations: z.array(GroundedCitationSchema).min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const ReusableCandidateSchema = ReusableCandidateDraftBaseSchema.omit({
  claimKeys: true,
})
  .extend({
    id: z.uuid(),
    clusterId: z.uuid(),
    claimIds: z.array(z.uuid()).min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const StoryIntelligenceSchema = z
  .object({
    cluster: StoredStoryClusterSchema,
    claims: z.array(GroundedClaimSchema).min(1),
    candidate: ReusableCandidateSchema,
  })
  .strict();

export type StoryClusterDraft = z.infer<typeof StoryClusterDraftSchema>;
export type GroundedClaimDraft = z.infer<typeof GroundedClaimDraftSchema>;
export type CandidateBaselineScores = z.infer<
  typeof CandidateBaselineScoresSchema
>;
export type ReusableCandidateDraft = z.infer<
  typeof ReusableCandidateDraftSchema
>;
export type StoryIntelligenceDraft = z.infer<
  typeof StoryIntelligenceDraftSchema
>;
export type StoredStoryCluster = z.infer<typeof StoredStoryClusterSchema>;
export type GroundedCitation = z.infer<typeof GroundedCitationSchema>;
export type GroundedClaim = z.infer<typeof GroundedClaimSchema>;
export type ReusableCandidate = z.infer<typeof ReusableCandidateSchema>;
export type StoryIntelligence = z.infer<typeof StoryIntelligenceSchema>;

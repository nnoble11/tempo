import { z } from "zod";

import { RankingComponentsSchema, RankingResultSchema } from "./ranking.js";

export const SourceCitationSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    sourceItemId: z.string().trim().min(1).max(200),
    canonicalUrl: z.url(),
    sourceTitle: z.string().trim().min(1).max(500),
    publisher: z.string().trim().min(1).max(200).optional(),
    publishedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export const CandidateUpdateSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    clusterId: z.string().trim().min(1).max(200),
    headline: z.string().trim().min(1).max(300),
    estimatedSeconds: z.number().int().min(15).max(3_600),
    interestIds: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
    citations: z.array(SourceCitationSchema).min(1).max(20),
    contentClass: z.literal("editorial"),
  })
  .strict()
  .superRefine((candidate, context) => {
    if (new Set(candidate.interestIds).size !== candidate.interestIds.length) {
      context.addIssue({
        code: "custom",
        message: "interestIds must not contain duplicates",
        path: ["interestIds"],
      });
    }

    const citationIds = candidate.citations.map((citation) => citation.id);
    if (new Set(citationIds).size !== citationIds.length) {
      context.addIssue({
        code: "custom",
        message: "citation ids must be unique within a candidate",
        path: ["citations"],
      });
    }
  });

export const BriefingPlanCandidateSchema = z
  .object({
    candidate: CandidateUpdateSchema,
    rankingComponents: RankingComponentsSchema,
  })
  .strict();

export const BriefingPlanRequestSchema = z
  .object({
    targetMinutes: z.number().int().min(1).max(60),
    candidates: z.array(BriefingPlanCandidateSchema).max(200),
  })
  .strict()
  .superRefine((request, context) => {
    const candidateIds = request.candidates.map(
      ({ candidate }) => candidate.id,
    );
    if (new Set(candidateIds).size !== candidateIds.length) {
      context.addIssue({
        code: "custom",
        message: "candidate ids must be unique",
        path: ["candidates"],
      });
    }

    const clusterIds = request.candidates.map(
      ({ candidate }) => candidate.clusterId,
    );
    if (new Set(clusterIds).size !== clusterIds.length) {
      context.addIssue({
        code: "custom",
        message: "only one candidate per story cluster may be planned",
        path: ["candidates"],
      });
    }
  });

export const BriefingSelectionSchema = z
  .object({
    candidateId: z.string().min(1),
    clusterId: z.string().min(1),
    position: z.number().int().positive(),
    primaryInterestId: z.string().min(1),
    allocatedSeconds: z.number().int().positive(),
    citationIds: z.array(z.string().min(1)).min(1),
    ranking: RankingResultSchema,
  })
  .strict();

export const BriefingPlanSchema = z
  .object({
    targetMinutes: z.number().int().min(1).max(60),
    targetSeconds: z.number().int().positive(),
    estimatedSeconds: z.number().int().nonnegative(),
    remainingSeconds: z.number().int().nonnegative(),
    selections: z.array(BriefingSelectionSchema),
  })
  .strict();

export type SourceCitation = z.infer<typeof SourceCitationSchema>;
export type CandidateUpdate = z.infer<typeof CandidateUpdateSchema>;
export type BriefingPlanCandidate = z.infer<typeof BriefingPlanCandidateSchema>;
export type BriefingPlanRequest = z.infer<typeof BriefingPlanRequestSchema>;
export type BriefingSelection = z.infer<typeof BriefingSelectionSchema>;
export type BriefingPlan = z.infer<typeof BriefingPlanSchema>;

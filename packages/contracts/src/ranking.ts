import { z } from "zod";

const ScoreSchema = z.number().min(0).max(1);

export const RankingComponentsSchema = z
  .object({
    personalRelevance: ScoreSchema,
    globalImportance: ScoreSchema,
    novelty: ScoreSchema,
    urgency: ScoreSchema,
    credibility: ScoreSchema,
    sourceDiversity: ScoreSchema,
    interestStrength: ScoreSchema,
    behavioralAffinity: ScoreSchema,
    recency: ScoreSchema,
    timingFit: ScoreSchema,
    redundancyPenalty: ScoreSchema,
    fatiguePenalty: ScoreSchema,
    clickbaitPenalty: ScoreSchema,
    commercialContentPenalty: ScoreSchema,
    confidence: ScoreSchema,
  })
  .strict();

export const RankingResultSchema = z
  .object({
    components: RankingComponentsSchema,
    baseScore: z.number().min(0),
    bonusScore: z.number().min(0),
    penaltyScore: z.number().min(0),
    finalScore: ScoreSchema,
  })
  .strict();

export type RankingComponents = z.infer<typeof RankingComponentsSchema>;
export type RankingResult = z.infer<typeof RankingResultSchema>;

import type { RankingComponents, RankingResult } from "@tempo/contracts";

export const RANKING_WEIGHTS = {
  globalImportance: 0.12,
  urgency: 0.12,
  interestStrength: 0.1,
  sourceDiversity: 0.05,
  behavioralAffinity: 0.05,
  recency: 0.06,
  redundancyPenalty: 0.25,
  fatiguePenalty: 0.1,
  clickbaitPenalty: 0.15,
  commercialContentPenalty: 0.5,
} as const;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const round = (value: number): number =>
  Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

export const scoreRanking = (components: RankingComponents): RankingResult => {
  const baseScore =
    components.personalRelevance *
    components.confidence *
    components.credibility *
    components.novelty *
    components.timingFit;

  const bonusScore =
    components.globalImportance * RANKING_WEIGHTS.globalImportance +
    components.urgency * RANKING_WEIGHTS.urgency +
    components.interestStrength * RANKING_WEIGHTS.interestStrength +
    components.sourceDiversity * RANKING_WEIGHTS.sourceDiversity +
    components.behavioralAffinity * RANKING_WEIGHTS.behavioralAffinity +
    components.recency * RANKING_WEIGHTS.recency;

  const penaltyScore =
    components.redundancyPenalty * RANKING_WEIGHTS.redundancyPenalty +
    components.fatiguePenalty * RANKING_WEIGHTS.fatiguePenalty +
    components.clickbaitPenalty * RANKING_WEIGHTS.clickbaitPenalty +
    components.commercialContentPenalty *
      RANKING_WEIGHTS.commercialContentPenalty;

  return {
    components: { ...components },
    baseScore: round(baseScore),
    bonusScore: round(bonusScore),
    penaltyScore: round(penaltyScore),
    finalScore: round(clamp(baseScore + bonusScore - penaltyScore)),
  };
};

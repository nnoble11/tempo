import type { RankingComponents } from "@tempo/contracts";
import { describe, expect, it } from "vitest";

import { scoreRanking } from "../src/index.js";

const baselineComponents: RankingComponents = {
  personalRelevance: 0.9,
  globalImportance: 0.7,
  novelty: 0.8,
  urgency: 0.4,
  credibility: 0.95,
  sourceDiversity: 0.8,
  interestStrength: 0.9,
  behavioralAffinity: 0.5,
  recency: 0.8,
  timingFit: 0.9,
  redundancyPenalty: 0.1,
  fatiguePenalty: 0.1,
  clickbaitPenalty: 0,
  commercialContentPenalty: 0,
  confidence: 0.9,
};

describe("scoreRanking", () => {
  it("retains the component scores used to calculate the final score", () => {
    const result = scoreRanking(baselineComponents);

    expect(result.components).toEqual(baselineComponents);
    expect(result.components).not.toBe(baselineComponents);
    expect(result.baseScore).toBeGreaterThan(0);
    expect(result.bonusScore).toBeGreaterThan(0);
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThanOrEqual(1);
  });

  it("lowers the final score when quality penalties increase", () => {
    const baseline = scoreRanking(baselineComponents);
    const penalized = scoreRanking({
      ...baselineComponents,
      redundancyPenalty: 1,
      fatiguePenalty: 1,
      clickbaitPenalty: 1,
    });

    expect(penalized.penaltyScore).toBeGreaterThan(baseline.penaltyScore);
    expect(penalized.finalScore).toBeLessThan(baseline.finalScore);
  });

  it("keeps commercial-content pressure visible and separate", () => {
    const editorial = scoreRanking(baselineComponents);
    const commercial = scoreRanking({
      ...baselineComponents,
      commercialContentPenalty: 1,
    });

    expect(commercial.components.commercialContentPenalty).toBe(1);
    expect(commercial.finalScore).toBeLessThan(editorial.finalScore);
  });
});

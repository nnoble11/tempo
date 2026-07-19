import type {
  BriefingPlanCandidate,
  BriefingPlanRequest,
  RankingComponents,
} from "@tempo/contracts";
import { describe, expect, it } from "vitest";

import { planBriefing } from "../src/index.js";

const highScore: RankingComponents = {
  personalRelevance: 0.95,
  globalImportance: 0.8,
  novelty: 0.9,
  urgency: 0.5,
  credibility: 0.95,
  sourceDiversity: 0.8,
  interestStrength: 0.9,
  behavioralAffinity: 0.7,
  recency: 0.9,
  timingFit: 0.9,
  redundancyPenalty: 0,
  fatiguePenalty: 0,
  clickbaitPenalty: 0,
  commercialContentPenalty: 0,
  confidence: 0.95,
};

const createCandidate = (
  id: string,
  interestId: string,
  estimatedSeconds: number,
  rankingComponents: RankingComponents = highScore,
): BriefingPlanCandidate => ({
  candidate: {
    id,
    clusterId: `cluster-${id}`,
    headline: `Headline for ${id}`,
    estimatedSeconds,
    interestIds: [interestId],
    citations: [
      {
        id: `citation-${id}`,
        sourceItemId: `source-${id}`,
        canonicalUrl: `https://example.com/${id}`,
        sourceTitle: `Source for ${id}`,
      },
    ],
    contentClass: "editorial",
  },
  rankingComponents,
});

describe("planBriefing", () => {
  it("never exceeds the requested duration", () => {
    const request: BriefingPlanRequest = {
      targetMinutes: 2,
      candidates: [
        createCandidate("one", "science", 90),
        createCandidate("two", "sports", 90),
        createCandidate("three", "finance", 30),
      ],
    };

    const plan = planBriefing(request);

    expect(plan.estimatedSeconds).toBeLessThanOrEqual(plan.targetSeconds);
    expect(plan.estimatedSeconds + plan.remainingSeconds).toBe(
      plan.targetSeconds,
    );
  });

  it("covers distinct interests before adding another item for one interest", () => {
    const mediumScore: RankingComponents = {
      ...highScore,
      personalRelevance: 0.8,
    };
    const lowerScore: RankingComponents = {
      ...highScore,
      personalRelevance: 0.6,
    };

    const plan = planBriefing({
      targetMinutes: 2,
      candidates: [
        createCandidate("science-primary", "science", 60, highScore),
        createCandidate("science-secondary", "science", 60, mediumScore),
        createCandidate("sports-primary", "sports", 60, lowerScore),
      ],
    });

    expect(plan.selections.map(({ candidateId }) => candidateId)).toEqual([
      "science-primary",
      "sports-primary",
    ]);
  });

  it("orders candidates deterministically when their scores match", () => {
    const plan = planBriefing({
      targetMinutes: 1,
      candidates: [
        createCandidate("zeta", "science", 60),
        createCandidate("alpha", "science", 60),
      ],
    });

    expect(plan.selections[0]?.candidateId).toBe("alpha");
  });

  it("does not mutate reusable candidate input", () => {
    const request: BriefingPlanRequest = {
      targetMinutes: 2,
      candidates: [createCandidate("one", "science", 60)],
    };
    const snapshot = structuredClone(request);

    planBriefing(request);

    expect(request).toEqual(snapshot);
  });

  it("rejects a factual candidate without a citation", () => {
    const candidate = createCandidate("one", "science", 60);
    candidate.candidate.citations = [];

    expect(() =>
      planBriefing({
        targetMinutes: 2,
        candidates: [candidate],
      }),
    ).toThrow();
  });

  it("rejects duplicate story clusters", () => {
    const first = createCandidate("one", "science", 60);
    const duplicate = createCandidate("two", "sports", 60);
    duplicate.candidate.clusterId = first.candidate.clusterId;

    expect(() =>
      planBriefing({
        targetMinutes: 2,
        candidates: [first, duplicate],
      }),
    ).toThrow();
  });
});

import type {
  GroundedBriefingGenerationRequest,
  RankingComponents,
  StoryIntelligence,
} from "@tempo/contracts";
import { describe, expect, it } from "vitest";

import {
  generateGroundedBriefing,
  NoGroundedBriefingItemsError,
} from "../src/index.js";

const userInterestId = "00000000-0000-4000-8000-000000000001";
const clusterId = "00000000-0000-4000-8000-000000000002";
const sourceItemId = "00000000-0000-4000-8000-000000000003";
const claimId = "00000000-0000-4000-8000-000000000004";
const citationId = "00000000-0000-4000-8000-000000000005";
const candidateId = "00000000-0000-4000-8000-000000000006";

const rankingComponents: RankingComponents = {
  personalRelevance: 0.95,
  globalImportance: 0.7,
  novelty: 0.9,
  urgency: 0.3,
  credibility: 0.98,
  sourceDiversity: 0.4,
  interestStrength: 1,
  behavioralAffinity: 0.6,
  recency: 0.95,
  timingFit: 0.9,
  redundancyPenalty: 0,
  fatiguePenalty: 0,
  clickbaitPenalty: 0,
  commercialContentPenalty: 0,
  confidence: 0.96,
};

const story = (estimatedSeconds = 45): StoryIntelligence => ({
  cluster: {
    id: clusterId,
    deduplicationKey: "nasa-earth-mission",
    canonicalTitle: "NASA announces a new Earth mission",
    summary: "NASA announced a mission focused on atmospheric change.",
    firstSeenAt: "2026-07-17T14:30:00.000Z",
    lastUpdatedAt: "2026-07-17T18:00:00.000Z",
    status: "active",
    sourceItems: [
      {
        sourceItemId,
        membershipScore: 1,
        isPrimary: true,
        canonicalUrl: "https://www.nasa.gov/news-release/earth-mission/",
        sourceTitle: "NASA announces a new Earth mission",
        publisher: "NASA News Releases",
        publishedAt: "2026-07-17T14:30:00.000Z",
      },
    ],
    createdAt: "2026-07-17T18:00:00.000Z",
    updatedAt: "2026-07-17T18:00:00.000Z",
  },
  claims: [
    {
      id: claimId,
      clusterId,
      key: "mission-purpose",
      kind: "source_fact",
      text: "The mission will study changes in Earth's atmosphere.",
      confidence: 0.98,
      isContested: false,
      citations: [
        {
          id: citationId,
          sourceItemId,
          supportType: "direct",
          supportingText:
            "The mission will study changes in Earth's atmosphere.",
          canonicalUrl: "https://www.nasa.gov/news-release/earth-mission/",
          sourceTitle: "NASA announces a new Earth mission",
          publisher: "NASA News Releases",
          publishedAt: "2026-07-17T14:30:00.000Z",
        },
      ],
      createdAt: "2026-07-17T18:00:00.000Z",
      updatedAt: "2026-07-17T18:00:00.000Z",
    },
  ],
  candidate: {
    id: candidateId,
    clusterId,
    key: "default",
    headline: "NASA plans a new atmosphere-monitoring mission",
    takeaway: "The mission will examine changes in Earth's atmosphere.",
    whatChanged: "NASA formally announced the mission today.",
    estimatedSeconds,
    language: "en-US",
    contentClass: "editorial",
    status: "ready",
    baselineScores: {
      globalImportance: 0.7,
      novelty: 0.9,
      urgency: 0.3,
      credibility: 0.98,
      sourceDiversity: 0.4,
      recency: 0.95,
      clickbaitPenalty: 0,
      confidence: 0.96,
    },
    claimIds: [claimId],
    promptVersion: "candidate-v1",
    modelVersion: "fixture-model",
    createdAt: "2026-07-17T18:00:00.000Z",
    updatedAt: "2026-07-17T18:00:00.000Z",
  },
});

const request = (estimatedSeconds = 45): GroundedBriefingGenerationRequest => ({
  targetMinutes: 1,
  scheduledFor: "2026-07-18T15:00:00.000Z",
  generatedAt: "2026-07-18T14:55:00.000Z",
  overview: "One meaningful science update is ready for you.",
  promptVersion: "briefing-v1",
  modelVersion: "deterministic",
  candidates: [
    {
      story: story(estimatedSeconds),
      userInterestId,
      whyItMatters:
        "You follow climate science and asked for major mission updates.",
      rankingComponents,
    },
  ],
});

describe("grounded briefing generation", () => {
  it("creates a finite canonical item with ranking and provenance snapshots", () => {
    const briefing = generateGroundedBriefing(request());

    expect(briefing.estimatedSeconds).toBe(45);
    expect(briefing.estimatedSeconds).toBeLessThanOrEqual(
      briefing.targetMinutes * 60,
    );
    expect(briefing.items).toHaveLength(1);
    expect(briefing.items[0]).toMatchObject({
      storyClusterId: clusterId,
      candidateUpdateId: candidateId,
      userInterestId,
      headline: "NASA plans a new atmosphere-monitoring mission",
      ranking: {
        components: rankingComponents,
      },
      claims: [
        {
          claimId,
          citations: [
            {
              citationId,
              sourceItemId,
              canonicalUrl: "https://www.nasa.gov/news-release/earth-mission/",
            },
          ],
        },
      ],
    });
    expect(briefing.actualWordCount).toBeGreaterThan(0);
  });

  it("refuses to label an over-budget candidate as a valid briefing", () => {
    expect(() => generateGroundedBriefing(request(90))).toThrow(
      NoGroundedBriefingItemsError,
    );
  });
});

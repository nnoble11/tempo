import type { StoryIntelligence, UserInterest } from "@tempo/contracts";
import { describe, expect, it } from "vitest";

import { assembleScheduledBriefing } from "../src/index.js";

const interest: UserInterest = {
  id: "00000000-0000-4000-8000-000000000001",
  interestId: "00000000-0000-4000-8000-000000000002",
  type: "topic",
  name: "Climate science",
  description: "Major climate and atmospheric research",
  importance: 5,
  expertiseLevel: "intermediate",
  desiredDepth: "standard",
  alertSensitivity: 1,
  preferredSources: ["NASA News"],
  blockedSources: [],
  keywords: ["climate", "atmosphere"],
  excludedKeywords: ["sponsored"],
  active: true,
  createdAt: "2026-07-18T10:00:00.000Z",
  updatedAt: "2026-07-18T10:00:00.000Z",
  lastInteractedAt: null,
};

const story: StoryIntelligence = {
  cluster: {
    id: "00000000-0000-4000-8000-000000000003",
    deduplicationKey: "atmosphere-mission",
    canonicalTitle: "NASA announces an atmosphere mission",
    summary: "The mission will study atmospheric and climate change.",
    firstSeenAt: "2026-07-18T10:00:00.000Z",
    lastUpdatedAt: "2026-07-18T11:00:00.000Z",
    status: "active",
    sourceItems: [
      {
        sourceItemId: "00000000-0000-4000-8000-000000000004",
        membershipScore: 1,
        isPrimary: true,
        canonicalUrl: "https://example.com/mission",
        sourceTitle: "NASA announces an atmosphere mission",
        publisher: "NASA News",
        publishedAt: "2026-07-18T10:00:00.000Z",
      },
    ],
    createdAt: "2026-07-18T11:00:00.000Z",
    updatedAt: "2026-07-18T11:00:00.000Z",
  },
  claims: [
    {
      id: "00000000-0000-4000-8000-000000000005",
      clusterId: "00000000-0000-4000-8000-000000000003",
      key: "purpose",
      kind: "source_fact",
      text: "The mission will study atmospheric change.",
      confidence: 0.98,
      isContested: false,
      citations: [
        {
          id: "00000000-0000-4000-8000-000000000006",
          sourceItemId: "00000000-0000-4000-8000-000000000004",
          supportType: "direct",
          supportingText: "The mission will study atmospheric change.",
          canonicalUrl: "https://example.com/mission",
          sourceTitle: "NASA announces an atmosphere mission",
          publisher: "NASA News",
          publishedAt: "2026-07-18T10:00:00.000Z",
        },
      ],
      createdAt: "2026-07-18T11:00:00.000Z",
      updatedAt: "2026-07-18T11:00:00.000Z",
    },
  ],
  candidate: {
    id: "00000000-0000-4000-8000-000000000007",
    clusterId: "00000000-0000-4000-8000-000000000003",
    key: "default",
    headline: "A new mission will monitor atmospheric change",
    takeaway: "NASA will measure changes in the atmosphere.",
    whatChanged: "The agency formally announced the mission.",
    estimatedSeconds: 45,
    language: "en-US",
    contentClass: "editorial",
    status: "ready",
    baselineScores: {
      globalImportance: 0.7,
      novelty: 0.9,
      urgency: 0.2,
      credibility: 0.98,
      sourceDiversity: 0.4,
      recency: 0.95,
      clickbaitPenalty: 0,
      confidence: 0.96,
    },
    claimIds: ["00000000-0000-4000-8000-000000000005"],
    promptVersion: "candidate-v1",
    modelVersion: "fixture",
    createdAt: "2026-07-18T11:00:00.000Z",
    updatedAt: "2026-07-18T11:00:00.000Z",
  },
};

describe("scheduled briefing assembly", () => {
  it("matches reusable stories to explicit interests and retains score components", () => {
    const assembly = assembleScheduledBriefing({
      targetMinutes: 5,
      scheduledFor: "2026-07-18T15:00:00.000Z",
      generatedAt: "2026-07-18T15:00:01.000Z",
      interests: [interest],
      stories: [story],
    });

    expect(assembly).not.toBeNull();
    expect(assembly?.matchedCandidateCount).toBe(1);
    expect(assembly?.request.candidates[0]).toMatchObject({
      userInterestId: interest.id,
      rankingComponents: {
        interestStrength: 1,
        credibility: 0.98,
        commercialContentPenalty: 0,
      },
    });
    expect(assembly?.request.overview).toContain("Climate science");
  });

  it("rejects excluded or unrelated candidates instead of filling volume", () => {
    expect(
      assembleScheduledBriefing({
        targetMinutes: 5,
        scheduledFor: "2026-07-18T15:00:00.000Z",
        generatedAt: "2026-07-18T15:00:01.000Z",
        interests: [{ ...interest, excludedKeywords: ["atmosphere"] }],
        stories: [story],
      }),
    ).toBeNull();
    expect(
      assembleScheduledBriefing({
        targetMinutes: 5,
        scheduledFor: "2026-07-18T15:00:00.000Z",
        generatedAt: "2026-07-18T15:00:01.000Z",
        interests: [
          {
            ...interest,
            name: "Japanese cooking",
            description: "Seasonal home cooking techniques",
            keywords: [],
          },
        ],
        stories: [story],
      }),
    ).toBeNull();
  });
});

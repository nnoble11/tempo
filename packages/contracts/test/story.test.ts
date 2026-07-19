import {
  StoryIntelligenceDraftSchema,
  type StoryIntelligenceDraft,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

const primarySourceItemId = "00000000-0000-4000-8000-000000000001";
const outsideSourceItemId = "00000000-0000-4000-8000-000000000002";

const validDraft = (): StoryIntelligenceDraft => ({
  cluster: {
    deduplicationKey: "nasa-earth-mission-2026",
    canonicalTitle: "NASA announces an Earth science mission",
    summary: "NASA announced a new mission focused on atmospheric change.",
    firstSeenAt: "2026-07-17T14:30:00.000Z",
    lastUpdatedAt: "2026-07-17T18:00:00.000Z",
    status: "active",
    sourceItems: [
      {
        sourceItemId: primarySourceItemId,
        membershipScore: 1,
        isPrimary: true,
      },
    ],
  },
  claims: [
    {
      key: "mission-purpose",
      kind: "source_fact",
      text: "The mission will study changes in Earth's atmosphere.",
      confidence: 0.98,
      isContested: false,
      citations: [
        {
          sourceItemId: primarySourceItemId,
          supportType: "direct",
          supportingText:
            "The mission will study changes in Earth's atmosphere.",
        },
      ],
    },
  ],
  candidate: {
    key: "default",
    headline: "NASA plans a new atmosphere-monitoring mission",
    takeaway: "The mission will examine changes in Earth's atmosphere.",
    whatChanged: "NASA formally announced the mission today.",
    estimatedSeconds: 45,
    language: "en-US",
    contentClass: "editorial",
    status: "ready",
    baselineScores: {
      globalImportance: 0.7,
      novelty: 0.9,
      urgency: 0.2,
      credibility: 0.99,
      sourceDiversity: 0.2,
      recency: 0.95,
      clickbaitPenalty: 0,
      confidence: 0.97,
    },
    claimKeys: ["mission-purpose"],
    promptVersion: "candidate-v1",
    modelVersion: "deterministic-fixture",
  },
});

describe("story intelligence contracts", () => {
  it("accepts a grounded reusable story aggregate", () => {
    expect(StoryIntelligenceDraftSchema.parse(validDraft())).toEqual(
      validDraft(),
    );
  });

  it("rejects citations to source items outside the cluster", () => {
    const draft = validDraft();
    draft.claims[0]?.citations.push({
      sourceItemId: outsideSourceItemId,
      supportType: "context",
      supportingText: null,
    });

    const result = StoryIntelligenceDraftSchema.safeParse(draft);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Claim citations must belong to the story cluster",
          }),
        ]),
      );
    }
  });

  it("rejects personalized ranking components in reusable baseline scores", () => {
    const draft = validDraft() as StoryIntelligenceDraft & {
      candidate: {
        baselineScores: StoryIntelligenceDraft["candidate"]["baselineScores"] & {
          personalRelevance: number;
        };
      };
    };
    draft.candidate.baselineScores.personalRelevance = 0.9;

    expect(StoryIntelligenceDraftSchema.safeParse(draft).success).toBe(false);
  });
});

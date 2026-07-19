import type {
  CanonicalBriefing,
  StoryIntelligence,
  UserInterest,
} from "@tempo/contracts";

export const FIXTURE_IDS = {
  userId: "00000000-0000-4000-8000-000000000101",
  interestId: "00000000-0000-4000-8000-000000000102",
  interestDefinitionId: "00000000-0000-4000-8000-000000000103",
  clusterId: "00000000-0000-4000-8000-000000000104",
  sourceItemId: "00000000-0000-4000-8000-000000000105",
  claimId: "00000000-0000-4000-8000-000000000106",
  citationId: "00000000-0000-4000-8000-000000000107",
  candidateId: "00000000-0000-4000-8000-000000000108",
  briefingId: "00000000-0000-4000-8000-000000000109",
  briefingItemId: "00000000-0000-4000-8000-000000000110",
} as const;

export const fixtureInterest = (
  overrides: Partial<UserInterest> = {},
): UserInterest => ({
  id: FIXTURE_IDS.interestId,
  interestId: FIXTURE_IDS.interestDefinitionId,
  type: "topic",
  name: "Climate science",
  description: "Major climate and atmospheric research",
  importance: 5,
  expertiseLevel: "intermediate",
  desiredDepth: "standard",
  alertSensitivity: 1,
  preferredSources: [],
  blockedSources: [],
  keywords: ["climate", "atmosphere"],
  excludedKeywords: [],
  active: true,
  createdAt: "2026-07-18T10:00:00.000Z",
  updatedAt: "2026-07-18T10:00:00.000Z",
  lastInteractedAt: null,
  ...overrides,
});

export const fixtureStory = (estimatedSeconds = 45): StoryIntelligence => ({
  cluster: {
    id: FIXTURE_IDS.clusterId,
    deduplicationKey: "atmosphere-mission",
    canonicalTitle: "NASA announces an atmosphere mission",
    summary: "The mission will study atmospheric and climate change.",
    firstSeenAt: "2026-07-18T10:00:00.000Z",
    lastUpdatedAt: "2026-07-18T11:00:00.000Z",
    status: "active",
    sourceItems: [
      {
        sourceItemId: FIXTURE_IDS.sourceItemId,
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
      id: FIXTURE_IDS.claimId,
      clusterId: FIXTURE_IDS.clusterId,
      key: "purpose",
      kind: "source_fact",
      text: "The mission will study atmospheric change.",
      confidence: 0.98,
      isContested: false,
      citations: [
        {
          id: FIXTURE_IDS.citationId,
          sourceItemId: FIXTURE_IDS.sourceItemId,
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
    id: FIXTURE_IDS.candidateId,
    clusterId: FIXTURE_IDS.clusterId,
    key: "default",
    headline: "A new mission will monitor atmospheric change",
    takeaway: "NASA will measure changes in the atmosphere.",
    whatChanged: "The agency formally announced the mission.",
    estimatedSeconds,
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
    claimIds: [FIXTURE_IDS.claimId],
    promptVersion: "candidate-v1",
    modelVersion: "fixture",
    createdAt: "2026-07-18T11:00:00.000Z",
    updatedAt: "2026-07-18T11:00:00.000Z",
  },
});

export const fixtureCanonicalBriefing = (): CanonicalBriefing => {
  const story = fixtureStory();
  const claim = story.claims[0];
  const citation = claim?.citations[0];
  if (claim === undefined || citation === undefined) {
    throw new Error("The story fixture is missing grounding.");
  }
  return {
    id: FIXTURE_IDS.briefingId,
    userId: FIXTURE_IDS.userId,
    targetMinutes: 5,
    actualWordCount: 42,
    estimatedSeconds: 45,
    scheduledFor: "2026-07-18T15:00:00.000Z",
    generatedAt: "2026-07-18T14:59:00.000Z",
    status: "ready",
    overview: "One meaningful climate-science update is ready.",
    promptVersion: "scheduled-v1",
    modelVersion: "none",
    items: [
      {
        id: FIXTURE_IDS.briefingItemId,
        briefingId: FIXTURE_IDS.briefingId,
        storyClusterId: story.cluster.id,
        candidateUpdateId: story.candidate.id,
        userInterestId: FIXTURE_IDS.interestId,
        position: 1,
        headline: story.candidate.headline,
        takeaway: story.candidate.takeaway,
        whyItMatters: "This matches your climate science interest.",
        whatChanged: story.candidate.whatChanged,
        estimatedSeconds: 45,
        ranking: {
          components: {
            personalRelevance: 0.9,
            globalImportance: 0.7,
            novelty: 0.9,
            urgency: 0.2,
            credibility: 0.98,
            sourceDiversity: 0.4,
            interestStrength: 1,
            behavioralAffinity: 0.5,
            recency: 0.95,
            timingFit: 1,
            redundancyPenalty: 0,
            fatiguePenalty: 0,
            clickbaitPenalty: 0,
            commercialContentPenalty: 0,
            confidence: 0.96,
          },
          baseScore: 0.762,
          bonusScore: 0.285,
          penaltyScore: 0,
          finalScore: 1,
        },
        claims: [
          {
            claimId: claim.id,
            key: claim.key,
            kind: claim.kind,
            text: claim.text,
            confidence: claim.confidence,
            isContested: claim.isContested,
            citations: [
              {
                citationId: citation.id,
                sourceItemId: citation.sourceItemId,
                canonicalUrl: citation.canonicalUrl,
                sourceTitle: citation.sourceTitle,
                publisher: citation.publisher,
                publishedAt: citation.publishedAt,
                supportType: citation.supportType,
                supportingText: citation.supportingText,
              },
            ],
          },
        ],
        createdAt: "2026-07-18T14:59:00.000Z",
      },
    ],
    createdAt: "2026-07-18T14:59:00.000Z",
    updatedAt: "2026-07-18T14:59:00.000Z",
  };
};

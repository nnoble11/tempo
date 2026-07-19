import {
  GroundedBriefingGenerationRequestSchema,
  type GroundedBriefingGenerationRequest,
  type RankingComponents,
  type StoryIntelligence,
  type UserInterest,
} from "@tempo/contracts";

export type ScheduledBriefingAssemblyInput = {
  targetMinutes: number;
  scheduledFor: string;
  generatedAt: string;
  interests: readonly UserInterest[];
  stories: readonly StoryIntelligence[];
};

export type ScheduledBriefingAssembly = {
  request: GroundedBriefingGenerationRequest;
  matchedCandidateCount: number;
  matchedInterestCount: number;
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "and",
  "but",
  "for",
  "from",
  "into",
  "major",
  "only",
  "that",
  "the",
  "their",
  "this",
  "with",
]);

const normalized = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();

const tokens = (value: string): Set<string> =>
  new Set(
    normalized(value)
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length >= 3 && !STOP_WORDS.has(token)) ?? [],
  );

const storySearchText = (story: StoryIntelligence): string =>
  [
    story.cluster.canonicalTitle,
    story.cluster.summary ?? "",
    story.candidate.headline,
    story.candidate.takeaway,
    story.candidate.whatChanged,
    ...story.claims.map(({ text }) => text),
  ].join(" ");

const sourceNames = (story: StoryIntelligence): Set<string> =>
  new Set(
    story.cluster.sourceItems.map(({ publisher }) => normalized(publisher)),
  );

type InterestMatch = {
  interest: UserInterest;
  relevance: number;
};

const scoreInterestMatch = (
  interest: UserInterest,
  story: StoryIntelligence,
): InterestMatch | null => {
  if (!interest.active) {
    return null;
  }
  const text = normalized(storySearchText(story));
  if (
    interest.excludedKeywords.some((keyword) =>
      text.includes(normalized(keyword)),
    )
  ) {
    return null;
  }
  const publishers = sourceNames(story);
  if (
    interest.blockedSources.some((publisher) =>
      publishers.has(normalized(publisher)),
    )
  ) {
    return null;
  }

  const name = normalized(interest.name);
  const exactNameMatch = name.length >= 3 && text.includes(name);
  const keywordMatches = interest.keywords.filter((keyword) =>
    text.includes(normalized(keyword)),
  ).length;
  const interestTokens = tokens(
    [interest.name, interest.description ?? "", ...interest.keywords].join(" "),
  );
  const storyTokens = tokens(text);
  const overlapCount = [...interestTokens].filter((token) =>
    storyTokens.has(token),
  ).length;
  const overlapRatio =
    interestTokens.size === 0 ? 0 : overlapCount / interestTokens.size;
  const preferredSourceMatch = interest.preferredSources.some((publisher) =>
    publishers.has(normalized(publisher)),
  );

  if (!exactNameMatch && keywordMatches === 0 && overlapCount === 0) {
    return null;
  }

  const relevance = Math.min(
    1,
    (exactNameMatch ? 0.5 : 0) +
      Math.min(0.3, keywordMatches * 0.15) +
      Math.min(0.4, overlapRatio * 0.8) +
      (preferredSourceMatch ? 0.1 : 0),
  );
  return {
    interest,
    relevance: Math.max(0.2, relevance),
  };
};

const bestInterestMatch = (
  interests: readonly UserInterest[],
  story: StoryIntelligence,
): InterestMatch | null => {
  const matches = interests.flatMap((interest) => {
    const match = scoreInterestMatch(interest, story);
    return match === null ? [] : [match];
  });
  matches.sort((left, right) => {
    const relevanceDifference = right.relevance - left.relevance;
    if (relevanceDifference !== 0) {
      return relevanceDifference;
    }
    const importanceDifference =
      right.interest.importance - left.interest.importance;
    if (importanceDifference !== 0) {
      return importanceDifference;
    }
    return left.interest.id.localeCompare(right.interest.id);
  });
  return matches[0] ?? null;
};

const rankingComponents = (
  story: StoryIntelligence,
  match: InterestMatch,
): RankingComponents => ({
  personalRelevance: match.relevance,
  globalImportance: story.candidate.baselineScores.globalImportance,
  novelty: story.candidate.baselineScores.novelty,
  urgency: story.candidate.baselineScores.urgency,
  credibility: story.candidate.baselineScores.credibility,
  sourceDiversity: story.candidate.baselineScores.sourceDiversity,
  interestStrength: match.interest.importance / 5,
  behavioralAffinity: 0.5,
  recency: story.candidate.baselineScores.recency,
  timingFit: 1,
  redundancyPenalty: 0,
  fatiguePenalty: 0,
  clickbaitPenalty: story.candidate.baselineScores.clickbaitPenalty,
  commercialContentPenalty: 0,
  confidence: story.candidate.baselineScores.confidence,
});

export const assembleScheduledBriefing = (
  input: ScheduledBriefingAssemblyInput,
): ScheduledBriefingAssembly | null => {
  const activeInterests = input.interests.filter(({ active }) => active);
  const candidates = input.stories.flatMap((story) => {
    const match = bestInterestMatch(activeInterests, story);
    if (match === null) {
      return [];
    }
    return [
      {
        story,
        userInterestId: match.interest.id,
        whyItMatters: `This update matches your interest in ${match.interest.name} at the ${match.interest.desiredDepth} depth you selected.`,
        rankingComponents: rankingComponents(story, match),
      },
    ];
  });
  if (candidates.length === 0) {
    return null;
  }

  const matchedInterestNames = [
    ...new Set(
      candidates.map(
        (candidate) =>
          activeInterests.find(({ id }) => id === candidate.userInterestId)
            ?.name,
      ),
    ),
  ].filter((name): name is string => name !== undefined);

  const request = GroundedBriefingGenerationRequestSchema.parse({
    targetMinutes: input.targetMinutes,
    scheduledFor: input.scheduledFor,
    generatedAt: input.generatedAt,
    overview: `Today’s ${input.targetMinutes}-minute briefing focuses on ${matchedInterestNames.slice(0, 3).join(", ")}.`,
    promptVersion: "deterministic-scheduled-assembly-v1",
    modelVersion: "none",
    candidates,
  });
  return {
    request,
    matchedCandidateCount: candidates.length,
    matchedInterestCount: matchedInterestNames.length,
  };
};

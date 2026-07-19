import {
  BriefingPlanRequestSchema,
  BriefingPlanSchema,
  type BriefingPlan,
  type BriefingPlanCandidate,
  type BriefingSelection,
  type CandidateUpdate,
  type RankingResult,
} from "@tempo/contracts";
import { scoreRanking } from "@tempo/ranking";

type RankedCandidate = {
  candidate: CandidateUpdate;
  ranking: RankingResult;
};

const compareRankedCandidates = (
  left: RankedCandidate,
  right: RankedCandidate,
): number => {
  const scoreDifference = right.ranking.finalScore - left.ranking.finalScore;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  if (left.candidate.id === right.candidate.id) {
    return 0;
  }

  return left.candidate.id < right.candidate.id ? -1 : 1;
};

const rankCandidate = ({
  candidate,
  rankingComponents,
}: BriefingPlanCandidate): RankedCandidate => ({
  candidate,
  ranking: scoreRanking(rankingComponents),
});

const findNewInterest = (
  candidate: CandidateUpdate,
  coveredInterestIds: ReadonlySet<string>,
): string | undefined =>
  candidate.interestIds.find(
    (interestId) => !coveredInterestIds.has(interestId),
  );

export const planBriefing = (input: unknown): BriefingPlan => {
  const request = BriefingPlanRequestSchema.parse(input);
  const targetSeconds = request.targetMinutes * 60;
  const rankedCandidates = request.candidates
    .map(rankCandidate)
    .sort(compareRankedCandidates);

  const selections: BriefingSelection[] = [];
  const selectedCandidateIds = new Set<string>();
  const coveredInterestIds = new Set<string>();
  let estimatedSeconds = 0;

  const selectCandidate = (
    rankedCandidate: RankedCandidate,
    primaryInterestId: string,
  ): boolean => {
    const { candidate, ranking } = rankedCandidate;
    if (estimatedSeconds + candidate.estimatedSeconds > targetSeconds) {
      return false;
    }

    estimatedSeconds += candidate.estimatedSeconds;
    selectedCandidateIds.add(candidate.id);
    coveredInterestIds.add(primaryInterestId);
    selections.push({
      candidateId: candidate.id,
      clusterId: candidate.clusterId,
      position: selections.length + 1,
      primaryInterestId,
      allocatedSeconds: candidate.estimatedSeconds,
      citationIds: candidate.citations.map((citation) => citation.id),
      ranking,
    });
    return true;
  };

  for (const rankedCandidate of rankedCandidates) {
    const newInterestId = findNewInterest(
      rankedCandidate.candidate,
      coveredInterestIds,
    );
    if (newInterestId !== undefined) {
      selectCandidate(rankedCandidate, newInterestId);
    }
  }

  for (const rankedCandidate of rankedCandidates) {
    if (selectedCandidateIds.has(rankedCandidate.candidate.id)) {
      continue;
    }

    const primaryInterestId = rankedCandidate.candidate.interestIds[0];
    if (primaryInterestId !== undefined) {
      selectCandidate(rankedCandidate, primaryInterestId);
    }
  }

  return BriefingPlanSchema.parse({
    targetMinutes: request.targetMinutes,
    targetSeconds,
    estimatedSeconds,
    remainingSeconds: targetSeconds - estimatedSeconds,
    selections,
  });
};

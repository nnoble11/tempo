import { createHash } from "node:crypto";

import {
  CanonicalBriefingDraftSchema,
  GroundedBriefingGenerationRequestSchema,
  type CanonicalBriefing,
  type CanonicalBriefingDraft,
  type GroundedBriefingCandidateContext,
  type GroundedBriefingGenerationRequest,
  type SaveCanonicalBriefingCommand,
  type SourceCitation,
} from "@tempo/contracts";

import { planBriefing } from "./plan-briefing.js";

export class NoGroundedBriefingItemsError extends Error {
  public constructor() {
    super("No grounded candidate fits within the briefing time budget.");
    this.name = "NoGroundedBriefingItemsError";
  }
}

export type CanonicalBriefingWriter = {
  saveCanonicalBriefing(
    userId: string,
    command: SaveCanonicalBriefingCommand,
  ): Promise<CanonicalBriefing>;
};

export type GenerateAndSaveGroundedBriefingCommand = {
  writer: CanonicalBriefingWriter;
  userId: string;
  idempotencyKey: string;
  request: GroundedBriefingGenerationRequest;
};

const selectedClaims = (context: GroundedBriefingCandidateContext) => {
  const claimsById = new Map(
    context.story.claims.map((claim) => [claim.id, claim]),
  );
  return context.story.candidate.claimIds.map((claimId) => {
    const claim = claimsById.get(claimId);
    if (claim === undefined) {
      throw new Error(
        `Candidate ${context.story.candidate.id} references unknown claim ${claimId}.`,
      );
    }
    return claim;
  });
};

const candidateCitations = (
  context: GroundedBriefingCandidateContext,
): SourceCitation[] => {
  const citations = selectedClaims(context).flatMap((claim) =>
    claim.citations.map((citation) => ({
      id: citation.id,
      sourceItemId: citation.sourceItemId,
      canonicalUrl: citation.canonicalUrl,
      sourceTitle: citation.sourceTitle,
      publisher: citation.publisher,
      ...(citation.publishedAt === null
        ? {}
        : { publishedAt: citation.publishedAt }),
    })),
  );
  return [
    ...new Map(citations.map((citation) => [citation.id, citation])).values(),
  ];
};

const countWords = (values: readonly string[]): number =>
  values.reduce((total, value) => {
    const normalized = value.trim();
    return (
      total + (normalized.length === 0 ? 0 : normalized.split(/\s+/).length)
    );
  }, 0);

export const generateGroundedBriefing = (
  input: unknown,
): CanonicalBriefingDraft => {
  const request = GroundedBriefingGenerationRequestSchema.parse(input);
  const contextsByCandidateId = new Map(
    request.candidates.map((context) => [context.story.candidate.id, context]),
  );
  const plan = planBriefing({
    targetMinutes: request.targetMinutes,
    candidates: request.candidates.map((context) => ({
      candidate: {
        id: context.story.candidate.id,
        clusterId: context.story.cluster.id,
        headline: context.story.candidate.headline,
        estimatedSeconds: context.story.candidate.estimatedSeconds,
        interestIds: [context.userInterestId],
        citations: candidateCitations(context),
        contentClass: "editorial" as const,
      },
      rankingComponents: context.rankingComponents,
    })),
  });
  if (plan.selections.length === 0) {
    throw new NoGroundedBriefingItemsError();
  }

  const items = plan.selections.map((selection) => {
    const context = contextsByCandidateId.get(selection.candidateId);
    if (context === undefined) {
      throw new Error(
        `The briefing plan selected unknown candidate ${selection.candidateId}.`,
      );
    }
    return {
      storyClusterId: context.story.cluster.id,
      candidateUpdateId: context.story.candidate.id,
      userInterestId: context.userInterestId,
      position: selection.position,
      headline: context.story.candidate.headline,
      takeaway: context.story.candidate.takeaway,
      whyItMatters: context.whyItMatters,
      whatChanged: context.story.candidate.whatChanged,
      estimatedSeconds: selection.allocatedSeconds,
      ranking: selection.ranking,
      claims: selectedClaims(context).map((claim) => ({
        claimId: claim.id,
        key: claim.key,
        kind: claim.kind,
        text: claim.text,
        confidence: claim.confidence,
        isContested: claim.isContested,
        citations: claim.citations.map((citation) => ({
          citationId: citation.id,
          sourceItemId: citation.sourceItemId,
          canonicalUrl: citation.canonicalUrl,
          sourceTitle: citation.sourceTitle,
          publisher: citation.publisher,
          publishedAt: citation.publishedAt,
          supportType: citation.supportType,
          supportingText: citation.supportingText,
        })),
      })),
    };
  });

  return CanonicalBriefingDraftSchema.parse({
    targetMinutes: request.targetMinutes,
    actualWordCount: countWords([
      request.overview,
      ...items.flatMap((item) => [
        item.headline,
        item.takeaway,
        item.whyItMatters,
        item.whatChanged,
      ]),
    ]),
    estimatedSeconds: plan.estimatedSeconds,
    scheduledFor: request.scheduledFor,
    generatedAt: request.generatedAt,
    status: "ready",
    overview: request.overview,
    promptVersion: request.promptVersion,
    modelVersion: request.modelVersion,
    items,
  });
};

export const generateAndSaveGroundedBriefing = async ({
  writer,
  userId,
  idempotencyKey,
  request,
}: GenerateAndSaveGroundedBriefingCommand): Promise<CanonicalBriefing> => {
  const parsedRequest = GroundedBriefingGenerationRequestSchema.parse(request);
  const requestHash = createHash("sha256")
    .update(JSON.stringify(parsedRequest))
    .digest("hex");
  const briefing = generateGroundedBriefing(parsedRequest);
  return writer.saveCanonicalBriefing(userId, {
    idempotencyKey,
    requestHash,
    briefing,
  });
};

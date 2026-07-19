import { createHash } from "node:crypto";

import {
  StoryIntelligenceDraftSchema,
  type StoryIntelligenceDraft,
} from "@tempo/contracts";
import type {
  ClaimedIntelligenceJob,
  IntelligenceJobRepository,
  StoryRepository,
} from "@tempo/database";

export type StoryIntelligenceProcessor = {
  process(job: ClaimedIntelligenceJob): Promise<StoryIntelligenceDraft>;
};

const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const normalizeTitle = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const firstClaim = (job: ClaimedIntelligenceJob): string => {
  const excerpt = job.excerpt?.trim();
  const source =
    excerpt === undefined || excerpt.length === 0 ? job.title.trim() : excerpt;
  const sentence = /^.*?[.!?](?:\s|$)/.exec(source)?.[0]?.trim() ?? source;
  return sentence.slice(0, 2_000);
};

export class DeterministicIntelligenceProcessor implements StoryIntelligenceProcessor {
  public process(job: ClaimedIntelligenceJob): Promise<StoryIntelligenceDraft> {
    const titleFingerprint = hash(normalizeTitle(job.title)).slice(0, 40);
    const claim = firstClaim(job);
    const seenAt = job.publishedAt ?? job.discoveredAt;
    return Promise.resolve(
      StoryIntelligenceDraftSchema.parse({
        cluster: {
          deduplicationKey: `title:${titleFingerprint}`,
          canonicalTitle: job.title,
          summary: claim,
          firstSeenAt: seenAt,
          lastUpdatedAt: job.discoveredAt,
          status: "active",
          sourceItems: [
            {
              sourceItemId: job.sourceItemId,
              membershipScore: 1,
              isPrimary: true,
            },
          ],
        },
        claims: [
          {
            key: `source:${job.contentHash.slice(0, 40)}`,
            kind: "source_fact",
            text: claim,
            confidence: 0.9,
            isContested: false,
            citations: [
              {
                sourceItemId: job.sourceItemId,
                supportType: "direct",
                supportingText: claim,
              },
            ],
          },
        ],
        candidate: {
          key: `candidate:${titleFingerprint}`,
          headline: job.title.slice(0, 300),
          takeaway: claim,
          whatChanged: `New coverage from ${job.publisher}.`,
          estimatedSeconds: Math.max(
            15,
            Math.min(180, Math.ceil(claim.split(/\s+/).length / 3.2)),
          ),
          language: job.language,
          contentClass: "editorial",
          status: "ready",
          baselineScores: {
            globalImportance: 0.55,
            novelty: 0.8,
            urgency: 0.35,
            credibility: 0.85,
            sourceDiversity: 0.35,
            recency: 0.9,
            clickbaitPenalty: 0.05,
            confidence: 0.9,
          },
          claimKeys: [`source:${job.contentHash.slice(0, 40)}`],
          promptVersion: "deterministic-extraction-v1",
          modelVersion: "rules-v1",
        },
      }),
    );
  }
}

export type IntelligenceCycleSummary = {
  claimed: number;
  completed: number;
  failed: number;
};

export const runIntelligenceCycle = async (options: {
  jobs: IntelligenceJobRepository;
  stories: StoryRepository;
  processor: StoryIntelligenceProcessor;
  workerId: string;
  now?: Date;
  limit?: number;
  maxAttempts?: number;
}): Promise<IntelligenceCycleSummary> => {
  const now = options.now ?? new Date();
  const jobs = await options.jobs.claimJobs({
    workerId: options.workerId,
    now: now.toISOString(),
    leaseUntil: new Date(now.valueOf() + 10 * 60_000).toISOString(),
    limit: options.limit ?? 25,
  });
  let completed = 0;
  let failed = 0;
  await Promise.all(
    jobs.map(async (job) => {
      try {
        const draft = await options.processor.process(job);
        const story = await options.stories.saveStoryIntelligence(draft);
        await options.jobs.completeJob({
          jobId: job.id,
          workerId: options.workerId,
          clusterId: story.cluster.id,
          completedAt: now.toISOString(),
        });
        completed += 1;
      } catch (error) {
        failed += 1;
        const terminal = job.attemptCount >= (options.maxAttempts ?? 3);
        await options.jobs.failJob({
          jobId: job.id,
          workerId: options.workerId,
          error:
            error instanceof Error
              ? `${error.name}: ${error.message}`
              : "Unknown intelligence processing error",
          failedAt: now.toISOString(),
          nextAttemptAt: terminal
            ? null
            : new Date(
                now.valueOf() + 60_000 * 2 ** Math.max(0, job.attemptCount - 1),
              ).toISOString(),
        });
      }
    }),
  );
  return { claimed: jobs.length, completed, failed };
};

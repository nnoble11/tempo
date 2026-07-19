import type {
  IntelligenceJobRepository,
  StoryRepository,
} from "@tempo/database";
import { describe, expect, it } from "vitest";

import {
  DeterministicIntelligenceProcessor,
  runIntelligenceCycle,
} from "../src/index.js";
import { fixtureStory } from "../../../test/fixtures/briefing.js";

const job = {
  id: "00000000-0000-4000-8000-000000000901",
  sourceItemId: "00000000-0000-4000-8000-000000000902",
  sourceKey: "nasa-news",
  publisher: "NASA News Releases",
  canonicalUrl: "https://www.nasa.gov/example",
  title: "NASA releases a new Earth mission update",
  excerpt: "NASA published new observations from its Earth mission.",
  publishedAt: "2026-07-18T12:00:00.000Z",
  discoveredAt: "2026-07-18T12:05:00.000Z",
  language: "en",
  contentHash: "a".repeat(64),
  attemptCount: 1,
};

describe("story intelligence worker", () => {
  it("extracts a grounded reusable story and completes the leased job", async () => {
    const completed: unknown[] = [];
    const jobs = {
      claimJobs: () => Promise.resolve([job]),
      completeJob: (command: unknown) => {
        completed.push(command);
        return Promise.resolve();
      },
      failJob: () => Promise.resolve(),
    } as unknown as IntelligenceJobRepository;
    const saved: unknown[] = [];
    const stories = {
      saveStoryIntelligence: (draft: unknown) => {
        saved.push(draft);
        return Promise.resolve(fixtureStory());
      },
    } as unknown as StoryRepository;

    const summary = await runIntelligenceCycle({
      jobs,
      stories,
      processor: new DeterministicIntelligenceProcessor(),
      workerId: "intelligence-worker",
      now: new Date("2026-07-18T12:06:00.000Z"),
    });

    expect(summary).toEqual({ claimed: 1, completed: 1, failed: 0 });
    expect(saved[0]).toMatchObject({
      claims: [
        {
          kind: "source_fact",
          citations: [{ sourceItemId: job.sourceItemId }],
        },
      ],
      candidate: {
        status: "ready",
        contentClass: "editorial",
        promptVersion: "deterministic-extraction-v1",
      },
    });
    expect(completed[0]).toMatchObject({ jobId: job.id });
  });
});

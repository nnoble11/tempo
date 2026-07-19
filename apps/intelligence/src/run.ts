import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import {
  createDatabasePool,
  PostgresIntelligenceJobRepository,
  PostgresStoryRepository,
} from "@tempo/database";
import {
  DeterministicIntelligenceProcessor,
  runIntelligenceCycle,
} from "@tempo/intelligence";
import { z } from "zod";

const environment = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(["true", "false"]).default("false"),
    INTELLIGENCE_WORKER_ID: z.string().min(1).optional(),
    INTELLIGENCE_MAX_JOBS: z.coerce.number().int().min(1).max(100).default(25),
  })
  .loose()
  .parse(process.env);

const pool = createDatabasePool({
  connectionString: environment.DATABASE_URL,
  useSsl: environment.DATABASE_SSL === "true",
});
try {
  const summary = await runIntelligenceCycle({
    jobs: new PostgresIntelligenceJobRepository(pool),
    stories: new PostgresStoryRepository(pool),
    processor: new DeterministicIntelligenceProcessor(),
    workerId:
      environment.INTELLIGENCE_WORKER_ID ??
      `${hostname()}-${process.pid}-${randomUUID()}`,
    limit: environment.INTELLIGENCE_MAX_JOBS,
  });
  process.stdout.write(
    `${JSON.stringify({ event: "story_intelligence_cycle_completed", ...summary })}\n`,
  );
  if (summary.failed > 0) process.exitCode = 1;
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      event: "story_intelligence_cycle_failed",
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : "Unknown error",
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}

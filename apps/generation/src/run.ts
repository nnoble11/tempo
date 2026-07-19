import {
  createDatabasePool,
  PostgresAccountRepository,
  PostgresBriefingRepository,
  PostgresDeliveryRepository,
  PostgresScheduledBriefingRunRepository,
  PostgresStoryRepository,
} from "@tempo/database";
import { ConfiguredDeliveryScheduler } from "@tempo/delivery";
import { runGenerationCycle } from "@tempo/generation";

import { loadGenerationConfig } from "./config.js";

const config = loadGenerationConfig(process.env);
const pool = createDatabasePool({
  connectionString: config.databaseUrl,
  useSsl: config.databaseSsl,
});

try {
  const deliveryRepository = new PostgresDeliveryRepository(pool);
  const deliveryScheduler = new ConfiguredDeliveryScheduler({
    repository: deliveryRepository,
    briefingBaseUrl: config.briefingPublicBaseUrl,
  });
  const summary = await runGenerationCycle({
    scheduleRepository: new PostgresScheduledBriefingRunRepository(pool),
    accountRepository: new PostgresAccountRepository(pool),
    storyRepository: new PostgresStoryRepository(pool),
    briefingRepository: new PostgresBriefingRepository(pool),
    workerId: config.workerId,
    maxRuns: config.maxRuns,
    maxCandidates: config.maxCandidates,
    leaseDurationMilliseconds: config.leaseDurationMilliseconds,
    maxAttempts: config.maxAttempts,
    onBriefingGenerated: (userId, briefing) =>
      deliveryScheduler
        .scheduleForBriefing(userId, briefing)
        .then(() => undefined),
  });
  process.stdout.write(
    `${JSON.stringify({
      event: "briefing_generation_cycle_completed",
      ...summary,
    })}\n`,
  );
  if (summary.outcomes.some(({ status }) => status === "failed")) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      event: "briefing_generation_cycle_failed",
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : "Unknown briefing generation runner error",
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}

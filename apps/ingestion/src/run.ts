import { createDatabasePool, PostgresSourceRepository } from "@tempo/database";
import { runIngestionCycle } from "@tempo/ingestion";
import {
  createFoundationSourceAdapters,
  FetchHttpClient,
} from "@tempo/source-adapters";

import { loadIngestionConfig } from "./config.js";

const config = loadIngestionConfig(process.env);
const pool = createDatabasePool({
  connectionString: config.databaseUrl,
  useSsl: config.databaseSsl,
});

try {
  const summary = await runIngestionCycle({
    adapters: createFoundationSourceAdapters(),
    repository: new PostgresSourceRepository(pool),
    fetcher: new FetchHttpClient({
      timeoutMilliseconds: config.httpTimeoutMilliseconds,
    }),
    workerId: config.workerId,
    maxSources: config.maxSources,
    leaseDurationMilliseconds: config.leaseDurationMilliseconds,
  });
  process.stdout.write(
    `${JSON.stringify({
      event: "source_ingestion_cycle_completed",
      ...summary,
    })}\n`,
  );
  if (summary.outcomes.some((outcome) => outcome.status === "failed")) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      event: "source_ingestion_cycle_failed",
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : "Unknown ingestion runner error",
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}

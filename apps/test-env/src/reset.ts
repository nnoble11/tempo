import { createDatabasePool } from "@tempo/database";

import { TestEnvironmentSchema } from "./config.js";

const environment = TestEnvironmentSchema.parse(process.env);
if (process.env.TEST_ENV_CONFIRM_RESET !== "tempo-test-only") {
  throw new Error(
    "Set TEST_ENV_CONFIRM_RESET=tempo-test-only to confirm the guarded reset.",
  );
}
const pool = createDatabasePool({
  connectionString: environment.DATABASE_URL,
  useSsl: environment.DATABASE_SSL === "true",
});
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    `
      CREATE TEMP TABLE tempo_reset_interest_ids ON COMMIT DROP AS
      SELECT interest_id
      FROM user_interests
      WHERE user_id = (SELECT id FROM users WHERE email = $1)
    `,
    [environment.TEST_USER_EMAIL],
  );
  await client.query(
    `
      CREATE TEMP TABLE tempo_reset_cluster_ids ON COMMIT DROP AS
      SELECT DISTINCT membership.cluster_id
      FROM story_cluster_items membership
      INNER JOIN source_items item ON item.id = membership.source_item_id
      INNER JOIN sources source ON source.id = item.source_id
      WHERE source.key = 'tempo-test-science'
    `,
  );
  await client.query(
    `
      DELETE FROM scheduled_briefing_runs
      WHERE user_id = (SELECT id FROM users WHERE email = $1)
    `,
    [environment.TEST_USER_EMAIL],
  );
  await client.query(
    `
      DELETE FROM briefings
      WHERE user_id = (SELECT id FROM users WHERE email = $1)
    `,
    [environment.TEST_USER_EMAIL],
  );
  await client.query("DELETE FROM users WHERE email = $1", [
    environment.TEST_USER_EMAIL,
  ]);
  await client.query(
    `
      DELETE FROM story_clusters
      WHERE id IN (SELECT cluster_id FROM tempo_reset_cluster_ids)
    `,
  );
  await client.query(
    `
      DELETE FROM source_items
      WHERE source_id = (SELECT id FROM sources WHERE key = 'tempo-test-science')
    `,
  );
  await client.query("DELETE FROM sources WHERE key = 'tempo-test-science'");
  await client.query(
    `
      DELETE FROM interests
      WHERE id IN (SELECT interest_id FROM tempo_reset_interest_ids)
        AND NOT EXISTS (
          SELECT 1
          FROM user_interests
          WHERE user_interests.interest_id = interests.id
        )
    `,
  );
  await client.query("COMMIT");
  process.stdout.write(
    `${JSON.stringify({ event: "tempo_test_environment_reset" })}\n`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

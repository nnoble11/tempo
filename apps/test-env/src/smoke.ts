import { createDatabasePool } from "@tempo/database";

import { TestEnvironmentSchema } from "./config.js";

const environment = TestEnvironmentSchema.parse(process.env);
const health = await fetch(new URL("/health", environment.TEST_API_URL));
if (!health.ok) {
  throw new Error(`Tempo API health failed with status ${health.status}.`);
}
const pool = createDatabasePool({
  connectionString: environment.DATABASE_URL,
  useSsl: environment.DATABASE_SSL === "true",
});
try {
  const result = await pool.query<{
    onboarded: boolean;
    briefing_count: number;
    grounded_item_count: number;
  }>(
    `
      SELECT
        app_user.onboarding_completed_at IS NOT NULL AS onboarded,
        COUNT(DISTINCT briefing.id)::INTEGER AS briefing_count,
        COUNT(item.id)::INTEGER AS grounded_item_count
      FROM users app_user
      LEFT JOIN briefings briefing ON briefing.user_id = app_user.id
      LEFT JOIN briefing_items item ON item.briefing_id = briefing.id
      WHERE app_user.email = $1
      GROUP BY app_user.id
    `,
    [environment.TEST_USER_EMAIL],
  );
  const state = result.rows[0];
  if (
    state === undefined ||
    !state.onboarded ||
    state.briefing_count < 1 ||
    state.grounded_item_count < 1
  ) {
    throw new Error("The test user does not have a grounded briefing.");
  }
  process.stdout.write(
    `${JSON.stringify({ event: "tempo_test_environment_smoke_passed", ...state })}\n`,
  );
} finally {
  await pool.end();
}

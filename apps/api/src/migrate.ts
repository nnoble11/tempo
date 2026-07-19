import { createDatabasePool, runMigrations } from "@tempo/database";

import { loadDatabaseConfig } from "./config.js";

const config = loadDatabaseConfig(process.env);
const pool = createDatabasePool({
  connectionString: config.databaseUrl,
  useSsl: config.databaseSsl,
});

try {
  const result = await runMigrations(pool);
  process.stdout.write(
    result.applied.length === 0
      ? "Database is up to date.\n"
      : `Applied migrations: ${result.applied.join(", ")}\n`,
  );
} finally {
  await pool.end();
}

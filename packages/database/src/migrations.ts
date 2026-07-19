import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Pool } from "pg";

const MIGRATION_FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const MIGRATION_LOCK_ID = 742_361_901;

export const migrationsDirectory = fileURLToPath(
  new URL("../../../infrastructure/migrations/", import.meta.url),
);

export type MigrationResult = {
  applied: string[];
};

export const runMigrations = async (
  pool: Pool,
  directory = migrationsDirectory,
): Promise<MigrationResult> => {
  const client = await pool.connect();
  const applied: string[] = [];
  let lockAcquired = false;

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tempo_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    lockAcquired = true;

    const migrationFiles = (await readdir(directory))
      .filter((fileName) => MIGRATION_FILE_PATTERN.test(fileName))
      .sort();
    const migrationRows = await client.query<{ name: string }>(
      "SELECT name FROM tempo_migrations",
    );
    const existingMigrations = new Set(
      migrationRows.rows.map(({ name }) => name),
    );

    for (const fileName of migrationFiles) {
      if (existingMigrations.has(fileName)) {
        continue;
      }

      const sql = await readFile(join(directory, fileName), {
        encoding: "utf8",
      });

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO tempo_migrations (name) VALUES ($1)", [
          fileName,
        ]);
        await client.query("COMMIT");
        applied.push(fileName);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return { applied };
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    }
    client.release();
  }
};

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createDatabasePool } from "@tempo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  startTestPostgres,
  type TestPostgres,
} from "../../../test/support/postgres.js";

const execFileAsync = promisify(execFile);

describe("test environment lifecycle", () => {
  let postgres: TestPostgres;

  beforeAll(async () => {
    postgres = await startTestPostgres();
  });

  afterAll(async () => {
    await postgres?.stop();
  });

  it("bootstraps idempotently and resets only the Tempo test fixture", async () => {
    const environment = {
      ...process.env,
      DATABASE_URL: postgres.connectionString,
      DATABASE_SSL: "false",
      TEST_USER_ID: "00000000-0000-4000-8000-000000000111",
      TEST_USER_EMAIL: "tempo.tester@example.com",
    };

    const first = await execFileAsync(
      "pnpm",
      ["--filter", "@tempo/test-env", "bootstrap"],
      { cwd: process.cwd(), env: environment },
    );
    const second = await execFileAsync(
      "pnpm",
      ["--filter", "@tempo/test-env", "bootstrap"],
      { cwd: process.cwd(), env: environment },
    );

    expect(first.stdout).toContain("tempo_test_environment_bootstrapped");
    expect(second.stdout).toContain("tempo_test_environment_bootstrapped");
    for (const output of [first.stdout, second.stdout]) {
      expect(output).not.toContain(environment.TEST_USER_ID);
      expect(output).not.toContain(environment.TEST_USER_EMAIL);
      expect(output).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
      );
    }

    const pool = createDatabasePool({
      connectionString: postgres.connectionString,
    });
    try {
      const state = await pool.query<{
        users: number;
        briefings: number;
        grounded_items: number;
      }>(
        `
            SELECT
              COUNT(DISTINCT app_user.id)::INTEGER AS users,
              COUNT(DISTINCT briefing.id)::INTEGER AS briefings,
              COUNT(item.id)::INTEGER AS grounded_items
            FROM users app_user
            LEFT JOIN briefings briefing ON briefing.user_id = app_user.id
            LEFT JOIN briefing_items item ON item.briefing_id = briefing.id
            WHERE app_user.email = 'tempo.tester@example.com'
          `,
      );
      expect(
        state.rows[0],
        `first bootstrap: ${first.stdout}\nsecond bootstrap: ${second.stdout}`,
      ).toEqual({
        users: 1,
        briefings: 1,
        grounded_items: 1,
      });
    } finally {
      await pool.end();
    }

    const reset = await execFileAsync(
      "pnpm",
      ["--filter", "@tempo/test-env", "reset"],
      {
        cwd: process.cwd(),
        env: {
          ...environment,
          TEST_ENV_CONFIRM_RESET: "tempo-test-only",
        },
      },
    );
    expect(reset.stdout).toContain("tempo_test_environment_reset");

    const verificationPool = createDatabasePool({
      connectionString: postgres.connectionString,
    });
    try {
      const result = await verificationPool.query<{ count: number }>(
        `
            SELECT COUNT(*)::INTEGER AS count
            FROM users
            WHERE email = 'tempo.tester@example.com'
          `,
      );
      expect(result.rows[0]?.count).toBe(0);
    } finally {
      await verificationPool.end();
    }
  }, 60_000);
});

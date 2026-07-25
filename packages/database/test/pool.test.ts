import { afterEach, describe, expect, it, vi } from "vitest";

import { createDatabasePool } from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createDatabasePool", () => {
  it("handles and safely reports idle client errors", async () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const pool = createDatabasePool({
      connectionString: "postgresql://localhost/tempo_test",
    });
    expect(pool.options.connectionTimeoutMillis).toBe(15_000);

    const error = Object.assign(new Error("sensitive connection context"), {
      code: "EADDRNOTAVAIL",
    });

    expect(pool.emit("error", error)).toBe(true);
    expect(stderr).toHaveBeenCalledWith(
      `${JSON.stringify({
        event: "database_pool_idle_client_error",
        code: "EADDRNOTAVAIL",
      })}\n`,
    );
    expect(stderr.mock.calls.flat().join(" ")).not.toContain(error.message);

    await pool.end();
  });
});

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

  it("verifies against a provided CA certificate when SSL is enabled", async () => {
    const caCert =
      "-----BEGIN CERTIFICATE-----\nMIItest\n-----END CERTIFICATE-----";
    const pool = createDatabasePool({
      connectionString: "postgresql://db.example/tempo",
      useSsl: true,
      caCert: `  ${caCert}  `,
    });

    expect(pool.options.ssl).toMatchObject({
      rejectUnauthorized: true,
      ca: caCert,
    });

    await pool.end();
  });

  it("keeps strict verification without a CA when none is provided", async () => {
    const pool = createDatabasePool({
      connectionString: "postgresql://db.example/tempo",
      useSsl: true,
    });

    expect(pool.options.ssl).toEqual({ rejectUnauthorized: true });

    await pool.end();
  });
});

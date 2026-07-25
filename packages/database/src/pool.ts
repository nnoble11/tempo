import { Pool } from "pg";

export type DatabasePoolOptions = {
  connectionString: string;
  useSsl?: boolean;
  maxConnections?: number;
};

const reportIdleClientError = (error: Error): void => {
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
  process.stderr.write(
    `${JSON.stringify({ event: "database_pool_idle_client_error", code })}\n`,
  );
};

export const createDatabasePool = ({
  connectionString,
  useSsl = false,
  maxConnections = 10,
}: DatabasePoolOptions): Pool => {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    max: maxConnections,
    ssl: useSsl ? { rejectUnauthorized: true } : undefined,
  });
  pool.on("error", reportIdleClientError);
  return pool;
};

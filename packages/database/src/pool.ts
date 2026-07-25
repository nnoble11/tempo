import { Pool } from "pg";

export type DatabasePoolOptions = {
  connectionString: string;
  useSsl?: boolean;
  maxConnections?: number;
  /**
   * PEM-encoded CA certificate used to verify the database server. Defaults to
   * the DATABASE_CA_CERT environment variable. Required for providers such as
   * Supabase whose pooler presents a self-signed chain that is not in Node's
   * default trust store; without it, SSL connections fail with
   * SELF_SIGNED_CERT_IN_CHAIN.
   */
  caCert?: string;
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
  caCert = process.env.DATABASE_CA_CERT,
}: DatabasePoolOptions): Pool => {
  const trimmedCaCert = caCert?.trim();
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    max: maxConnections,
    ssl: useSsl
      ? {
          rejectUnauthorized: true,
          ...(trimmedCaCert ? { ca: trimmedCaCert } : {}),
        }
      : undefined,
  });
  pool.on("error", reportIdleClientError);
  return pool;
};

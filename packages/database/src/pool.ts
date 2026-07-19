import { Pool } from "pg";

export type DatabasePoolOptions = {
  connectionString: string;
  useSsl?: boolean;
  maxConnections?: number;
};

export const createDatabasePool = ({
  connectionString,
  useSsl = false,
  maxConnections = 10,
}: DatabasePoolOptions): Pool =>
  new Pool({
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: maxConnections,
    ssl: useSsl ? { rejectUnauthorized: true } : undefined,
  });

import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { z } from "zod";

const IngestionEnvironmentSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(["true", "false"]).default("false"),
    INGESTION_WORKER_ID: z.string().trim().min(1).optional(),
    INGESTION_MAX_SOURCES: z.coerce.number().int().min(1).max(100).default(10),
    INGESTION_LEASE_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(3_600)
      .default(600),
    INGESTION_HTTP_TIMEOUT_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(60)
      .default(15),
  })
  .loose();

export type IngestionConfig = {
  databaseUrl: string;
  databaseSsl: boolean;
  workerId: string;
  maxSources: number;
  leaseDurationMilliseconds: number;
  httpTimeoutMilliseconds: number;
};

export const loadIngestionConfig = (
  environment: NodeJS.ProcessEnv,
): IngestionConfig => {
  const parsed = IngestionEnvironmentSchema.parse(environment);
  return {
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL === "true",
    workerId:
      parsed.INGESTION_WORKER_ID ??
      `${hostname()}-${process.pid}-${randomUUID()}`,
    maxSources: parsed.INGESTION_MAX_SOURCES,
    leaseDurationMilliseconds: parsed.INGESTION_LEASE_SECONDS * 1_000,
    httpTimeoutMilliseconds: parsed.INGESTION_HTTP_TIMEOUT_SECONDS * 1_000,
  };
};

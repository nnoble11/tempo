import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { z } from "zod";

const GenerationEnvironmentSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(["true", "false"]).default("false"),
    BRIEFING_PUBLIC_BASE_URL: z.url().default("http://127.0.0.1:3000"),
    GENERATION_WORKER_ID: z.string().trim().min(1).optional(),
    GENERATION_MAX_RUNS: z.coerce.number().int().min(1).max(100).default(10),
    GENERATION_MAX_CANDIDATES: z.coerce
      .number()
      .int()
      .min(1)
      .max(200)
      .default(100),
    GENERATION_LEASE_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(3_600)
      .default(600),
    GENERATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  })
  .loose();

export type GenerationConfig = {
  databaseUrl: string;
  databaseSsl: boolean;
  workerId: string;
  maxRuns: number;
  maxCandidates: number;
  leaseDurationMilliseconds: number;
  maxAttempts: number;
  briefingPublicBaseUrl: string;
};

export const loadGenerationConfig = (
  environment: NodeJS.ProcessEnv,
): GenerationConfig => {
  const parsed = GenerationEnvironmentSchema.parse(environment);
  return {
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL === "true",
    workerId:
      parsed.GENERATION_WORKER_ID ??
      `${hostname()}-${process.pid}-${randomUUID()}`,
    maxRuns: parsed.GENERATION_MAX_RUNS,
    maxCandidates: parsed.GENERATION_MAX_CANDIDATES,
    leaseDurationMilliseconds: parsed.GENERATION_LEASE_SECONDS * 1_000,
    maxAttempts: parsed.GENERATION_MAX_ATTEMPTS,
    briefingPublicBaseUrl: parsed.BRIEFING_PUBLIC_BASE_URL,
  };
};

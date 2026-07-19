import { z } from "zod";

const BooleanEnvironmentSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
const OptionalSecretSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);
const OriginListSchema = z
  .string()
  .default("http://localhost:3000,http://127.0.0.1:3000")
  .transform((value, context) => {
    const origins = value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one CORS origin is required",
      });
      return z.NEVER;
    }
    for (const origin of origins) {
      try {
        if (new URL(origin).origin !== origin) {
          throw new Error("Origin must not include a path.");
        }
      } catch {
        context.addIssue({
          code: "custom",
          message: `Invalid CORS origin: ${origin}`,
        });
        return z.NEVER;
      }
    }
    return origins;
  });

const DatabaseEnvironmentSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: BooleanEnvironmentSchema.default(false),
  })
  .loose();

const ApiEnvironmentSchema = DatabaseEnvironmentSchema.extend({
  SUPABASE_URL: z.url(),
  SUPABASE_JWT_AUDIENCE: z.string().trim().min(1).default("authenticated"),
  HOST: z.string().trim().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  MIGRATE_ON_START: BooleanEnvironmentSchema.default(false),
  DELIVERY_VERIFICATION_SECRET: z.string().min(32),
  CORS_ALLOWED_ORIGINS: OriginListSchema,
  RESEND_API_KEY: OptionalSecretSchema,
  RESEND_FROM_EMAIL: OptionalSecretSchema,
  TWILIO_ACCOUNT_SID: OptionalSecretSchema,
  TWILIO_AUTH_TOKEN: OptionalSecretSchema,
  TWILIO_FROM_NUMBER: OptionalSecretSchema,
});

export type DatabaseConfig = {
  databaseUrl: string;
  databaseSsl: boolean;
};

export type ApiConfig = DatabaseConfig & {
  supabaseUrl: string;
  supabaseJwtAudience: string;
  host: string;
  port: number;
  migrateOnStart: boolean;
  deliveryVerificationSecret: string;
  allowedOrigins: string[];
  resend?: { apiKey: string; from: string };
  twilio?: { accountSid: string; authToken: string; fromNumber: string };
};

export const loadDatabaseConfig = (
  environment: NodeJS.ProcessEnv,
): DatabaseConfig => {
  const parsed = DatabaseEnvironmentSchema.parse(environment);
  return {
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL,
  };
};

export const loadApiConfig = (environment: NodeJS.ProcessEnv): ApiConfig => {
  const parsed = ApiEnvironmentSchema.parse(environment);
  return {
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL,
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseJwtAudience: parsed.SUPABASE_JWT_AUDIENCE,
    host: parsed.HOST,
    port: parsed.PORT,
    migrateOnStart: parsed.MIGRATE_ON_START,
    deliveryVerificationSecret: parsed.DELIVERY_VERIFICATION_SECRET,
    allowedOrigins: parsed.CORS_ALLOWED_ORIGINS,
    ...(parsed.RESEND_API_KEY !== undefined &&
    parsed.RESEND_FROM_EMAIL !== undefined
      ? {
          resend: {
            apiKey: parsed.RESEND_API_KEY,
            from: parsed.RESEND_FROM_EMAIL,
          },
        }
      : {}),
    ...(parsed.TWILIO_ACCOUNT_SID !== undefined &&
    parsed.TWILIO_AUTH_TOKEN !== undefined &&
    parsed.TWILIO_FROM_NUMBER !== undefined
      ? {
          twilio: {
            accountSid: parsed.TWILIO_ACCOUNT_SID,
            authToken: parsed.TWILIO_AUTH_TOKEN,
            fromNumber: parsed.TWILIO_FROM_NUMBER,
          },
        }
      : {}),
  };
};

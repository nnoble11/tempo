import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { z } from "zod";

const OptionalSecretSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);
const OptionalPhoneSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .optional(),
);

const DeliveryEnvironmentSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(["true", "false"]).default("false"),
    DELIVERY_WORKER_ID: z.string().trim().min(1).optional(),
    DELIVERY_MAX_RECORDS: z.coerce.number().int().min(1).max(100).default(50),
    DELIVERY_LEASE_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(3_600)
      .default(300),
    DELIVERY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    EXPO_ACCESS_TOKEN: OptionalSecretSchema,
    RESEND_API_KEY: OptionalSecretSchema,
    RESEND_FROM_EMAIL: OptionalSecretSchema,
    TWILIO_ACCOUNT_SID: OptionalSecretSchema,
    TWILIO_AUTH_TOKEN: OptionalSecretSchema,
    TWILIO_FROM_NUMBER: OptionalPhoneSchema,
  })
  .loose()
  .superRefine((environment, context) => {
    if (
      (environment.RESEND_API_KEY === undefined) !==
      (environment.RESEND_FROM_EMAIL === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "RESEND_API_KEY and RESEND_FROM_EMAIL must be configured together",
      });
    }
    const twilioValues = [
      environment.TWILIO_ACCOUNT_SID,
      environment.TWILIO_AUTH_TOKEN,
      environment.TWILIO_FROM_NUMBER,
    ];
    const configuredTwilioValues = twilioValues.filter(
      (value) => value !== undefined,
    ).length;
    if (configuredTwilioValues !== 0 && configuredTwilioValues !== 3) {
      context.addIssue({
        code: "custom",
        message:
          "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must be configured together",
      });
    }
  });

export type DeliveryConfig = {
  databaseUrl: string;
  databaseSsl: boolean;
  workerId: string;
  maxDeliveries: number;
  leaseDurationMilliseconds: number;
  maxAttempts: number;
  expoAccessToken?: string;
  resend?: {
    apiKey: string;
    from: string;
  };
  twilio?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
};

export const loadDeliveryConfig = (
  environment: NodeJS.ProcessEnv,
): DeliveryConfig => {
  const parsed = DeliveryEnvironmentSchema.parse(environment);
  return {
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL === "true",
    workerId:
      parsed.DELIVERY_WORKER_ID ??
      `${hostname()}-${process.pid}-${randomUUID()}`,
    maxDeliveries: parsed.DELIVERY_MAX_RECORDS,
    leaseDurationMilliseconds: parsed.DELIVERY_LEASE_SECONDS * 1_000,
    maxAttempts: parsed.DELIVERY_MAX_ATTEMPTS,
    ...(parsed.EXPO_ACCESS_TOKEN === undefined
      ? {}
      : { expoAccessToken: parsed.EXPO_ACCESS_TOKEN }),
    ...(parsed.RESEND_API_KEY === undefined ||
    parsed.RESEND_FROM_EMAIL === undefined
      ? {}
      : {
          resend: {
            apiKey: parsed.RESEND_API_KEY,
            from: parsed.RESEND_FROM_EMAIL,
          },
        }),
    ...(parsed.TWILIO_ACCOUNT_SID === undefined ||
    parsed.TWILIO_AUTH_TOKEN === undefined ||
    parsed.TWILIO_FROM_NUMBER === undefined
      ? {}
      : {
          twilio: {
            accountSid: parsed.TWILIO_ACCOUNT_SID,
            authToken: parsed.TWILIO_AUTH_TOKEN,
            fromNumber: parsed.TWILIO_FROM_NUMBER,
          },
        }),
  };
};

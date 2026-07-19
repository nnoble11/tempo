import { z } from "zod";

export const DeliveryChannelSchema = z.enum(["push", "email", "sms"]);
export const DeliveryEndpointVerificationStatusSchema = z.enum([
  "pending",
  "verified",
]);

const ExpoPushTokenSchema = z
  .string()
  .trim()
  .max(300)
  .regex(
    /^(?:ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/,
    "Expected an Expo push token",
  );

const SmsDestinationSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Expected an E.164 phone number");

export const UpsertDeliveryEndpointSchema = z.discriminatedUnion("channel", [
  z
    .object({
      channel: z.literal("push"),
      destination: ExpoPushTokenSchema,
      enabled: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      channel: z.literal("email"),
      destination: z.email(),
      enabled: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      channel: z.literal("sms"),
      destination: SmsDestinationSchema,
      enabled: z.boolean().default(true),
    })
    .strict(),
]);

const StoredEndpointFields = {
  id: z.uuid(),
  userId: z.uuid(),
  enabled: z.boolean(),
  verificationStatus: DeliveryEndpointVerificationStatusSchema,
  verifiedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
} as const;

export const DeliveryEndpointSchema = z.discriminatedUnion("channel", [
  z
    .object({
      ...StoredEndpointFields,
      channel: z.literal("push"),
      destination: ExpoPushTokenSchema,
    })
    .strict(),
  z
    .object({
      ...StoredEndpointFields,
      channel: z.literal("email"),
      destination: z.email(),
    })
    .strict(),
  z
    .object({
      ...StoredEndpointFields,
      channel: z.literal("sms"),
      destination: SmsDestinationSchema,
    })
    .strict(),
]);

export const DeliveryEndpointListSchema = z
  .object({
    items: z.array(DeliveryEndpointSchema),
  })
  .strict();

export const RequestEndpointVerificationResultSchema = z
  .object({
    endpoint: DeliveryEndpointSchema,
    expiresAt: z.iso.datetime(),
  })
  .strict();

export const VerifyDeliveryEndpointInputSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();

export const PushDeliveryPayloadSchema = z
  .object({
    channel: z.literal("push"),
    to: ExpoPushTokenSchema,
    title: z.string().trim().min(1).max(100),
    body: z.string().trim().min(1).max(240),
    url: z.url(),
    data: z
      .object({
        briefingId: z.uuid(),
        url: z.url(),
      })
      .strict(),
  })
  .strict();

export const EmailDeliveryPayloadSchema = z
  .object({
    channel: z.literal("email"),
    to: z.email(),
    subject: z.string().trim().min(1).max(200),
    text: z.string().trim().min(1).max(100_000),
    html: z.string().trim().min(1).max(200_000),
  })
  .strict();

export const SmsDeliveryPayloadSchema = z
  .object({
    channel: z.literal("sms"),
    to: SmsDestinationSchema,
    body: z.string().trim().min(1).max(320),
    url: z.url(),
  })
  .strict();

export const DeliveryPayloadSchema = z.discriminatedUnion("channel", [
  PushDeliveryPayloadSchema,
  EmailDeliveryPayloadSchema,
  SmsDeliveryPayloadSchema,
]);

export const DeliveryStatusSchema = z.enum([
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
]);

export const SaveDeliveryCommandSchema = z
  .object({
    briefingId: z.uuid(),
    endpointId: z.uuid().nullable(),
    channel: DeliveryChannelSchema,
    destination: z.string().trim().min(1).max(500),
    destinationHash: z.string().regex(/^[a-f0-9]{64}$/),
    payload: DeliveryPayloadSchema,
    scheduledFor: z.iso.datetime(),
    idempotencyKey: z.string().trim().min(1).max(200),
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((command, context) => {
    if (
      command.payload.channel !== command.channel ||
      command.payload.to !== command.destination
    ) {
      context.addIssue({
        code: "custom",
        message: "Delivery payload must match its channel and destination",
        path: ["payload"],
      });
    }
  });

export const DeliverySchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    briefingId: z.uuid(),
    endpointId: z.uuid().nullable(),
    channel: DeliveryChannelSchema,
    destination: z.string().min(1).max(500),
    destinationHash: z.string().regex(/^[a-f0-9]{64}$/),
    payload: DeliveryPayloadSchema,
    status: DeliveryStatusSchema,
    scheduledFor: z.iso.datetime(),
    nextAttemptAt: z.iso.datetime().nullable(),
    attemptCount: z.number().int().nonnegative(),
    workerId: z.string().min(1).max(200).nullable(),
    leaseExpiresAt: z.iso.datetime().nullable(),
    providerMessageId: z.string().max(500).nullable(),
    lastError: z.string().max(2_000).nullable(),
    sentAt: z.iso.datetime().nullable(),
    receiptStatus: z
      .enum(["not_applicable", "pending", "processing", "accepted", "failed"])
      .nullable(),
    receiptCheckedAt: z.iso.datetime().nullable(),
    receiptError: z.string().max(2_000).nullable(),
    idempotencyKey: z.string().min(1).max(200),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const DeliveryListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const DeliveryListSchema = z
  .object({
    items: z.array(DeliverySchema),
  })
  .strict();

export type DeliveryChannel = z.infer<typeof DeliveryChannelSchema>;
export type UpsertDeliveryEndpoint = z.infer<
  typeof UpsertDeliveryEndpointSchema
>;
export type DeliveryEndpoint = z.infer<typeof DeliveryEndpointSchema>;
export type DeliveryEndpointVerificationStatus = z.infer<
  typeof DeliveryEndpointVerificationStatusSchema
>;
export type RequestEndpointVerificationResult = z.infer<
  typeof RequestEndpointVerificationResultSchema
>;
export type VerifyDeliveryEndpointInput = z.infer<
  typeof VerifyDeliveryEndpointInputSchema
>;
export type DeliveryPayload = z.infer<typeof DeliveryPayloadSchema>;
export type PushDeliveryPayload = z.infer<typeof PushDeliveryPayloadSchema>;
export type EmailDeliveryPayload = z.infer<typeof EmailDeliveryPayloadSchema>;
export type SmsDeliveryPayload = z.infer<typeof SmsDeliveryPayloadSchema>;
export type SaveDeliveryCommand = z.infer<typeof SaveDeliveryCommandSchema>;
export type Delivery = z.infer<typeof DeliverySchema>;
export type DeliveryListQuery = z.infer<typeof DeliveryListQuerySchema>;

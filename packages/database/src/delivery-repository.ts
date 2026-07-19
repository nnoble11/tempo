import { createHash } from "node:crypto";

import {
  DeliveryEndpointSchema,
  DeliverySchema,
  SaveDeliveryCommandSchema,
  UpsertDeliveryEndpointSchema,
  type Delivery,
  type DeliveryChannel,
  type DeliveryEndpoint,
  type DeliveryEndpointVerificationStatus,
  type DeliveryPreferenceChannel,
  type UpsertDeliveryEndpoint,
} from "@tempo/contracts";
import type { Pool, QueryResultRow } from "pg";

import { IdempotencyConflictError } from "./briefing-repository.js";

export type DeliveryConfiguration = {
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  preferredChannels: DeliveryPreferenceChannel[];
  endpoints: DeliveryEndpoint[];
};

export type EndpointVerificationResult =
  | { status: "verified"; endpoint: DeliveryEndpoint }
  | { status: "invalid" }
  | { status: "not_found" };

export type ClaimedPushReceipt = {
  deliveryId: string;
  endpointId: string | null;
  providerMessageId: string;
  attemptCount: number;
};

export type ClaimDueDeliveriesCommand = {
  workerId: string;
  now: string;
  leaseUntil: string;
  limit: number;
};

export type MarkDeliverySentCommand = {
  deliveryId: string;
  workerId: string;
  providerMessageId: string;
  sentAt: string;
};

export type MarkDeliveryFailedCommand = {
  deliveryId: string;
  workerId: string;
  error: string;
  failedAt: string;
  nextAttemptAt: string | null;
};

export type DeliveryRepository = {
  upsertEndpoint(
    userId: string,
    input: UpsertDeliveryEndpoint,
    verifiedIdentityEmail?: string | null,
  ): Promise<DeliveryEndpoint>;
  listEndpoints(userId: string): Promise<DeliveryEndpoint[]>;
  disableEndpoint(userId: string, endpointId: string): Promise<boolean>;
  requestEndpointVerification(
    userId: string,
    endpointId: string,
    codeHash: string,
    expiresAt: string,
  ): Promise<DeliveryEndpoint | null>;
  verifyEndpoint(
    userId: string,
    endpointId: string,
    codeHash: string,
    now: string,
  ): Promise<EndpointVerificationResult>;
  getConfiguration(userId: string): Promise<DeliveryConfiguration>;
  saveDelivery(userId: string, input: unknown): Promise<Delivery>;
  listDeliveries(userId: string, limit: number): Promise<Delivery[]>;
  claimDueDeliveries(command: ClaimDueDeliveriesCommand): Promise<Delivery[]>;
  markDeliverySent(command: MarkDeliverySentCommand): Promise<void>;
  markDeliveryFailed(command: MarkDeliveryFailedCommand): Promise<void>;
  claimPushReceipts(
    command: ClaimDueDeliveriesCommand,
  ): Promise<ClaimedPushReceipt[]>;
  markPushReceiptAccepted(
    deliveryId: string,
    workerId: string,
    checkedAt: string,
  ): Promise<void>;
  markPushReceiptFailed(
    deliveryId: string,
    workerId: string,
    error: string,
    checkedAt: string,
    nextAttemptAt: string | null,
    disableEndpoint: boolean,
  ): Promise<void>;
};

type DeliveryEndpointRow = QueryResultRow & {
  id: string;
  user_id: string;
  channel: DeliveryChannel;
  destination: string;
  enabled: boolean;
  verification_status: DeliveryEndpointVerificationStatus;
  verified_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type DeliveryRow = QueryResultRow & {
  id: string;
  user_id: string;
  briefing_id: string;
  endpoint_id: string | null;
  channel: DeliveryChannel;
  destination: string;
  destination_hash: string;
  payload_json: unknown;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  scheduled_for: Date | string;
  next_attempt_at: Date | string | null;
  attempt_count: number;
  worker_id: string | null;
  lease_expires_at: Date | string | null;
  provider_message_id: string | null;
  last_error: string | null;
  sent_at: Date | string | null;
  receipt_status:
    "not_applicable" | "pending" | "processing" | "accepted" | "failed" | null;
  receipt_checked_at: Date | string | null;
  receipt_error: string | null;
  idempotency_key: string;
  request_hash: string;
  created_at: Date | string;
  updated_at: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null): string | null =>
  value === null ? null : toIsoString(value);

const destinationHash = (destination: string): string =>
  createHash("sha256").update(destination).digest("hex");

const normalizeEndpoint = (
  input: UpsertDeliveryEndpoint,
): UpsertDeliveryEndpoint => {
  if (input.channel === "email") {
    return {
      ...input,
      destination: input.destination.toLocaleLowerCase(),
    };
  }
  return input;
};

const mapEndpoint = (row: DeliveryEndpointRow): DeliveryEndpoint =>
  DeliveryEndpointSchema.parse({
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    destination: row.destination,
    enabled: row.enabled,
    verificationStatus: row.verification_status,
    verifiedAt: toNullableIsoString(row.verified_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });

const mapDelivery = (row: DeliveryRow): Delivery =>
  DeliverySchema.parse({
    id: row.id,
    userId: row.user_id,
    briefingId: row.briefing_id,
    endpointId: row.endpoint_id,
    channel: row.channel,
    destination: row.destination,
    destinationHash: row.destination_hash,
    payload: row.payload_json,
    status: row.status,
    scheduledFor: toIsoString(row.scheduled_for),
    nextAttemptAt: toNullableIsoString(row.next_attempt_at),
    attemptCount: row.attempt_count,
    workerId: row.worker_id,
    leaseExpiresAt: toNullableIsoString(row.lease_expires_at),
    providerMessageId: row.provider_message_id,
    lastError: row.last_error,
    sentAt: toNullableIsoString(row.sent_at),
    receiptStatus: row.receipt_status,
    receiptCheckedAt: toNullableIsoString(row.receipt_checked_at),
    receiptError: row.receipt_error,
    idempotencyKey: row.idempotency_key,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });

const deliveryColumns = `
  id,
  user_id,
  briefing_id,
  endpoint_id,
  channel,
  destination,
  destination_hash,
  payload_json,
  status,
  scheduled_for,
  next_attempt_at,
  attempt_count,
  worker_id,
  lease_expires_at,
  provider_message_id,
  last_error,
  sent_at,
  receipt_status,
  receipt_checked_at,
  receipt_error,
  idempotency_key,
  request_hash,
  created_at,
  updated_at
`;

const returningDeliveryColumns = `
  delivery.id,
  delivery.user_id,
  delivery.briefing_id,
  delivery.endpoint_id,
  delivery.channel,
  delivery.destination,
  delivery.destination_hash,
  delivery.payload_json,
  delivery.status,
  delivery.scheduled_for,
  delivery.next_attempt_at,
  delivery.attempt_count,
  delivery.worker_id,
  delivery.lease_expires_at,
  delivery.provider_message_id,
  delivery.last_error,
  delivery.sent_at,
  delivery.receipt_status,
  delivery.receipt_checked_at,
  delivery.receipt_error,
  delivery.idempotency_key,
  delivery.request_hash,
  delivery.created_at,
  delivery.updated_at
`;

const requireClaimedUpdate = (rowCount: number | null): void => {
  if (rowCount !== 1) {
    throw new Error("The delivery lease was lost.");
  }
};

export class PostgresDeliveryRepository implements DeliveryRepository {
  public constructor(private readonly pool: Pool) {}

  public async upsertEndpoint(
    userId: string,
    input: UpsertDeliveryEndpoint,
    verifiedIdentityEmail: string | null = null,
  ): Promise<DeliveryEndpoint> {
    const endpoint = normalizeEndpoint(
      UpsertDeliveryEndpointSchema.parse(input),
    );
    const identityVerified =
      endpoint.channel === "push" ||
      (endpoint.channel === "email" &&
        verifiedIdentityEmail?.toLocaleLowerCase() === endpoint.destination);
    const result = await this.pool.query<DeliveryEndpointRow>(
      `
        INSERT INTO delivery_endpoints (
          user_id,
          channel,
          destination,
          destination_hash,
          enabled,
          verification_status,
          verified_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          CASE WHEN $6 THEN 'verified' ELSE 'pending' END,
          CASE WHEN $6 THEN NOW() ELSE NULL END
        )
        ON CONFLICT (user_id, channel, destination_hash) DO UPDATE
        SET
          destination = EXCLUDED.destination,
          enabled = EXCLUDED.enabled,
          verification_status = CASE
            WHEN $6 THEN 'verified'
            ELSE delivery_endpoints.verification_status
          END,
          verified_at = CASE
            WHEN $6 THEN COALESCE(delivery_endpoints.verified_at, NOW())
            ELSE delivery_endpoints.verified_at
          END,
          verification_code_hash = CASE
            WHEN $6 THEN NULL
            ELSE delivery_endpoints.verification_code_hash
          END,
          verification_expires_at = CASE
            WHEN $6 THEN NULL
            ELSE delivery_endpoints.verification_expires_at
          END,
          updated_at = NOW()
        RETURNING
          id,
          user_id,
          channel,
          destination,
          enabled,
          verification_status,
          verified_at,
          created_at,
          updated_at
      `,
      [
        userId,
        endpoint.channel,
        endpoint.destination,
        destinationHash(endpoint.destination),
        endpoint.enabled,
        identityVerified,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error("Failed to store the delivery endpoint.");
    }
    return mapEndpoint(row);
  }

  public async listEndpoints(userId: string): Promise<DeliveryEndpoint[]> {
    const result = await this.pool.query<DeliveryEndpointRow>(
      `
        SELECT
          id,
          user_id,
          channel,
          destination,
          enabled,
          verification_status,
          verified_at,
          created_at,
          updated_at
        FROM delivery_endpoints
        WHERE user_id = $1
        ORDER BY channel, created_at, id
      `,
      [userId],
    );
    return result.rows.map(mapEndpoint);
  }

  public async requestEndpointVerification(
    userId: string,
    endpointId: string,
    codeHash: string,
    expiresAt: string,
  ): Promise<DeliveryEndpoint | null> {
    const result = await this.pool.query<DeliveryEndpointRow>(
      `
        UPDATE delivery_endpoints
        SET
          verification_code_hash = $3,
          verification_expires_at = $4,
          verification_attempt_count = 0,
          updated_at = NOW()
        WHERE
          id = $1
          AND user_id = $2
          AND enabled = TRUE
          AND channel IN ('email', 'sms')
          AND verification_status = 'pending'
        RETURNING
          id,
          user_id,
          channel,
          destination,
          enabled,
          verification_status,
          verified_at,
          created_at,
          updated_at
      `,
      [endpointId, userId, codeHash, expiresAt],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapEndpoint(row);
  }

  public async verifyEndpoint(
    userId: string,
    endpointId: string,
    codeHash: string,
    now: string,
  ): Promise<EndpointVerificationResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<
        DeliveryEndpointRow & {
          verification_code_hash: string | null;
          verification_expires_at: Date | string | null;
          verification_attempt_count: number;
        }
      >(
        `
          SELECT
            id,
            user_id,
            channel,
            destination,
            enabled,
            verification_status,
            verified_at,
            verification_code_hash,
            verification_expires_at,
            verification_attempt_count,
            created_at,
            updated_at
          FROM delivery_endpoints
          WHERE id = $1 AND user_id = $2
          FOR UPDATE
        `,
        [endpointId, userId],
      );
      const row = result.rows[0];
      if (row === undefined) {
        await client.query("COMMIT");
        return { status: "not_found" };
      }
      if (row.verification_status === "verified") {
        await client.query("COMMIT");
        return { status: "verified", endpoint: mapEndpoint(row) };
      }
      const valid =
        row.enabled &&
        row.verification_code_hash === codeHash &&
        row.verification_expires_at !== null &&
        new Date(row.verification_expires_at) >= new Date(now) &&
        row.verification_attempt_count < 5;
      if (!valid) {
        await client.query(
          `
            UPDATE delivery_endpoints
            SET
              verification_attempt_count = LEAST(
                verification_attempt_count + 1,
                5
              ),
              updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `,
          [endpointId, userId],
        );
        await client.query("COMMIT");
        return { status: "invalid" };
      }
      const verified = await client.query<DeliveryEndpointRow>(
        `
          UPDATE delivery_endpoints
          SET
            verification_status = 'verified',
            verified_at = $3,
            verification_code_hash = NULL,
            verification_expires_at = NULL,
            verification_attempt_count = 0,
            updated_at = NOW()
          WHERE id = $1 AND user_id = $2
          RETURNING
            id,
            user_id,
            channel,
            destination,
            enabled,
            verification_status,
            verified_at,
            created_at,
            updated_at
        `,
        [endpointId, userId, now],
      );
      const verifiedRow = verified.rows[0];
      if (verifiedRow === undefined) {
        throw new Error("Failed to verify the delivery endpoint.");
      }
      await client.query("COMMIT");
      return { status: "verified", endpoint: mapEndpoint(verifiedRow) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async disableEndpoint(
    userId: string,
    endpointId: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `
        UPDATE delivery_endpoints
        SET enabled = FALSE, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
      `,
      [endpointId, userId],
    );
    return result.rowCount === 1;
  }

  public async getConfiguration(
    userId: string,
  ): Promise<DeliveryConfiguration> {
    const result = await this.pool.query<{
      timezone: string;
      quiet_hours_start: string | null;
      quiet_hours_end: string | null;
      delivery_channels: DeliveryPreferenceChannel[];
    }>(
      `
        SELECT
          preference.timezone,
          preference.quiet_hours_start::TEXT,
          preference.quiet_hours_end::TEXT,
          preference.delivery_channels
        FROM users app_user
        INNER JOIN user_preferences preference
          ON preference.user_id = app_user.id
        WHERE app_user.id = $1
      `,
      [userId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error("The delivery configuration user was not found.");
    }
    return {
      timezone: row.timezone,
      quietHoursStart: row.quiet_hours_start?.slice(0, 5) ?? null,
      quietHoursEnd: row.quiet_hours_end?.slice(0, 5) ?? null,
      preferredChannels: row.delivery_channels,
      endpoints: (await this.listEndpoints(userId)).filter(
        ({ enabled, verificationStatus }) =>
          enabled && verificationStatus === "verified",
      ),
    };
  }

  public async saveDelivery(userId: string, input: unknown): Promise<Delivery> {
    const command = SaveDeliveryCommandSchema.parse(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const ownership = await client.query(
        `
          SELECT briefing.id
          FROM briefings briefing
          WHERE briefing.id = $1 AND briefing.user_id = $2
        `,
        [command.briefingId, userId],
      );
      if (ownership.rows[0] === undefined) {
        throw new Error("Cannot schedule delivery for an unknown briefing.");
      }
      if (command.endpointId !== null) {
        const endpoint = await client.query(
          `
            SELECT id
            FROM delivery_endpoints
            WHERE
              id = $1
              AND user_id = $2
              AND channel = $3
              AND destination_hash = $4
              AND enabled = TRUE
              AND verification_status = 'verified'
          `,
          [
            command.endpointId,
            userId,
            command.channel,
            command.destinationHash,
          ],
        );
        if (endpoint.rows[0] === undefined) {
          throw new Error("The delivery endpoint is unavailable.");
        }
      }

      const inserted = await client.query<DeliveryRow>(
        `
          INSERT INTO deliveries (
            user_id,
            briefing_id,
            endpoint_id,
            channel,
            destination,
            destination_hash,
            payload_json,
            status,
            scheduled_for,
            next_attempt_at,
            idempotency_key,
            request_hash
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7::JSONB, 'pending',
            $8, $8, $9, $10
          )
          ON CONFLICT (user_id, idempotency_key) DO NOTHING
          RETURNING ${deliveryColumns}
        `,
        [
          userId,
          command.briefingId,
          command.endpointId,
          command.channel,
          command.destination,
          command.destinationHash,
          JSON.stringify(command.payload),
          command.scheduledFor,
          command.idempotencyKey,
          command.requestHash,
        ],
      );
      const insertedRow = inserted.rows[0];
      if (insertedRow !== undefined) {
        await client.query("COMMIT");
        return mapDelivery(insertedRow);
      }

      const existing = await client.query<DeliveryRow>(
        `
          SELECT ${deliveryColumns}
          FROM deliveries
          WHERE user_id = $1 AND idempotency_key = $2
          FOR UPDATE
        `,
        [userId, command.idempotencyKey],
      );
      const existingRow = existing.rows[0];
      if (existingRow === undefined) {
        throw new Error("The delivery idempotency record disappeared.");
      }
      if (existingRow.request_hash !== command.requestHash) {
        throw new IdempotencyConflictError(
          "The delivery idempotency key was reused with different input.",
        );
      }
      await client.query("COMMIT");
      return mapDelivery(existingRow);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async listDeliveries(
    userId: string,
    limit: number,
  ): Promise<Delivery[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("limit must be between 1 and 100.");
    }
    const result = await this.pool.query<DeliveryRow>(
      `
        SELECT ${deliveryColumns}
        FROM deliveries
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
      `,
      [userId, limit],
    );
    return result.rows.map(mapDelivery);
  }

  public async claimDueDeliveries(
    command: ClaimDueDeliveriesCommand,
  ): Promise<Delivery[]> {
    if (command.workerId.trim().length === 0 || command.workerId.length > 200) {
      throw new Error("workerId must be between 1 and 200 characters.");
    }
    if (
      !Number.isInteger(command.limit) ||
      command.limit < 1 ||
      command.limit > 100
    ) {
      throw new Error("limit must be between 1 and 100.");
    }
    if (new Date(command.leaseUntil) <= new Date(command.now)) {
      throw new Error("leaseUntil must be later than now.");
    }

    const result = await this.pool.query<DeliveryRow>(
      `
        WITH claimable AS (
          SELECT id
          FROM deliveries
          WHERE
            scheduled_for <= $2::TIMESTAMPTZ
            AND (
              status = 'pending'
              OR (
                status = 'failed'
                AND next_attempt_at IS NOT NULL
                AND next_attempt_at <= $2::TIMESTAMPTZ
              )
              OR (
                status = 'processing'
                AND lease_expires_at <= $2::TIMESTAMPTZ
              )
            )
          ORDER BY scheduled_for, id
          FOR UPDATE SKIP LOCKED
          LIMIT $4
        )
        UPDATE deliveries delivery
        SET
          status = 'processing',
          worker_id = $1,
          lease_expires_at = $3,
          next_attempt_at = NULL,
          attempt_count = delivery.attempt_count + 1,
          updated_at = $2
        FROM claimable
        WHERE delivery.id = claimable.id
        RETURNING ${returningDeliveryColumns}
      `,
      [command.workerId, command.now, command.leaseUntil, command.limit],
    );
    return result.rows.map(mapDelivery);
  }

  public async markDeliverySent(
    command: MarkDeliverySentCommand,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE deliveries
        SET
          status = 'sent',
          provider_message_id = $3,
          sent_at = $4,
          receipt_status = CASE
            WHEN channel = 'push' THEN 'pending'
            ELSE 'not_applicable'
          END,
          receipt_next_attempt_at = CASE
            WHEN channel = 'push' THEN $4::TIMESTAMPTZ + INTERVAL '30 seconds'
            ELSE NULL
          END,
          worker_id = NULL,
          lease_expires_at = NULL,
          next_attempt_at = NULL,
          last_error = NULL,
          updated_at = $4
        WHERE id = $1 AND status = 'processing' AND worker_id = $2
      `,
      [
        command.deliveryId,
        command.workerId,
        command.providerMessageId,
        command.sentAt,
      ],
    );
    requireClaimedUpdate(result.rowCount);
  }

  public async markDeliveryFailed(
    command: MarkDeliveryFailedCommand,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE deliveries
        SET
          status = 'failed',
          worker_id = NULL,
          lease_expires_at = NULL,
          next_attempt_at = $3,
          last_error = $4,
          updated_at = $5
        WHERE id = $1 AND status = 'processing' AND worker_id = $2
      `,
      [
        command.deliveryId,
        command.workerId,
        command.nextAttemptAt,
        command.error.slice(0, 2_000),
        command.failedAt,
      ],
    );
    requireClaimedUpdate(result.rowCount);
  }

  public async claimPushReceipts(
    command: ClaimDueDeliveriesCommand,
  ): Promise<ClaimedPushReceipt[]> {
    const result = await this.pool.query<{
      delivery_id: string;
      endpoint_id: string | null;
      provider_message_id: string;
      receipt_attempt_count: number;
    }>(
      `
        WITH claimable AS (
          SELECT id
          FROM deliveries
          WHERE
            channel = 'push'
            AND status = 'sent'
            AND provider_message_id IS NOT NULL
            AND (
              (
                receipt_status IN ('pending', 'failed')
                AND receipt_next_attempt_at IS NOT NULL
                AND receipt_next_attempt_at <= $2::TIMESTAMPTZ
              )
              OR (
                receipt_status = 'processing'
                AND receipt_lease_expires_at <= $2::TIMESTAMPTZ
              )
            )
          ORDER BY receipt_next_attempt_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT $4
        )
        UPDATE deliveries delivery
        SET
          receipt_status = 'processing',
          receipt_worker_id = $1,
          receipt_lease_expires_at = $3,
          receipt_next_attempt_at = NULL,
          receipt_attempt_count = delivery.receipt_attempt_count + 1,
          updated_at = $2
        FROM claimable
        WHERE delivery.id = claimable.id
        RETURNING
          delivery.id AS delivery_id,
          delivery.endpoint_id,
          delivery.provider_message_id,
          delivery.receipt_attempt_count
      `,
      [command.workerId, command.now, command.leaseUntil, command.limit],
    );
    return result.rows.map((row) => ({
      deliveryId: row.delivery_id,
      endpointId: row.endpoint_id,
      providerMessageId: row.provider_message_id,
      attemptCount: row.receipt_attempt_count,
    }));
  }

  public async markPushReceiptAccepted(
    deliveryId: string,
    workerId: string,
    checkedAt: string,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE deliveries
        SET
          receipt_status = 'accepted',
          receipt_checked_at = $3,
          receipt_error = NULL,
          receipt_worker_id = NULL,
          receipt_lease_expires_at = NULL,
          receipt_next_attempt_at = NULL,
          updated_at = $3
        WHERE
          id = $1
          AND receipt_status = 'processing'
          AND receipt_worker_id = $2
      `,
      [deliveryId, workerId, checkedAt],
    );
    requireClaimedUpdate(result.rowCount);
  }

  public async markPushReceiptFailed(
    deliveryId: string,
    workerId: string,
    error: string,
    checkedAt: string,
    nextAttemptAt: string | null,
    disableEndpoint: boolean,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ endpoint_id: string | null }>(
        `
          UPDATE deliveries
          SET
            receipt_status = 'failed',
            receipt_checked_at = $3,
            receipt_error = $4,
            receipt_worker_id = NULL,
            receipt_lease_expires_at = NULL,
            receipt_next_attempt_at = $5,
            updated_at = $3
          WHERE
            id = $1
            AND receipt_status = 'processing'
            AND receipt_worker_id = $2
          RETURNING endpoint_id
        `,
        [deliveryId, workerId, checkedAt, error.slice(0, 2_000), nextAttemptAt],
      );
      requireClaimedUpdate(result.rowCount);
      const endpointId = result.rows[0]?.endpoint_id;
      if (disableEndpoint && endpointId !== null && endpointId !== undefined) {
        await client.query(
          `
            UPDATE delivery_endpoints
            SET enabled = FALSE, updated_at = $2
            WHERE id = $1
          `,
          [endpointId, checkedAt],
        );
      }
      await client.query("COMMIT");
    } catch (error_) {
      await client.query("ROLLBACK");
      throw error_;
    } finally {
      client.release();
    }
  }
}

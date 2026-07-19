import { createHash } from "node:crypto";

import {
  BriefingInteractionSchema,
  CanonicalBriefingSchema,
  CreateBriefingInteractionSchema,
  SaveCanonicalBriefingCommandSchema,
  type BriefingInteraction,
  type CanonicalBriefing,
} from "@tempo/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export class IdempotencyConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export type BriefingRepository = {
  saveCanonicalBriefing(
    userId: string,
    input: unknown,
  ): Promise<CanonicalBriefing>;
  getBriefing(
    userId: string,
    briefingId: string,
  ): Promise<CanonicalBriefing | null>;
  getLatestBriefing(
    userId: string,
    availableAt: string,
  ): Promise<CanonicalBriefing | null>;
  getBriefingByGenerationKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<CanonicalBriefing | null>;
  recordInteraction(
    userId: string,
    briefingId: string,
    briefingItemId: string,
    input: unknown,
  ): Promise<BriefingInteraction | null>;
};

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

type BriefingRow = QueryResultRow & {
  id: string;
  user_id: string;
  target_minutes: number;
  actual_word_count: number;
  estimated_seconds: number;
  scheduled_for: Date | string;
  generated_at: Date | string;
  status: "ready" | "delivered" | "archived";
  overview: string;
  prompt_version: string;
  model_version: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type BriefingItemRow = QueryResultRow & {
  id: string;
  briefing_id: string;
  candidate_update_id: string;
  story_cluster_id: string;
  user_interest_id: string;
  position: number;
  headline: string;
  takeaway: string;
  why_it_matters: string;
  what_changed: string;
  estimated_seconds: number;
  ranking_json: unknown;
  grounding_json: unknown;
  created_at: Date | string;
};

type GenerationRequestRow = QueryResultRow & {
  request_hash: string;
  status: "processing" | "completed";
  briefing_id: string | null;
};

type InteractionRow = QueryResultRow & {
  id: string;
  user_id: string;
  briefing_item_id: string;
  event_type:
    | "opened"
    | "expanded"
    | "saved"
    | "source_clicked"
    | "useful"
    | "not_useful"
    | "dismissed"
    | "deferred";
  value_json: unknown;
  occurred_at: Date | string;
  idempotency_key: string;
  request_hash: string;
  created_at: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const hashInteractionRequest = (input: {
  briefingId: string;
  briefingItemId: string;
  eventType: string;
  value: Record<string, unknown>;
  occurredAt: string | null;
}): string =>
  createHash("sha256")
    .update(
      JSON.stringify([
        input.briefingId,
        input.briefingItemId,
        input.eventType,
        input.value,
        input.occurredAt,
      ]),
    )
    .digest("hex");

const mapInteraction = (row: InteractionRow): BriefingInteraction =>
  BriefingInteractionSchema.parse({
    id: row.id,
    userId: row.user_id,
    briefingItemId: row.briefing_item_id,
    eventType: row.event_type,
    value: row.value_json,
    occurredAt: toIsoString(row.occurred_at),
    idempotencyKey: row.idempotency_key,
    createdAt: toIsoString(row.created_at),
  });

const loadBriefing = async (
  database: Queryable,
  userId: string,
  briefingId: string,
): Promise<CanonicalBriefing | null> => {
  const briefingResult = await database.query<BriefingRow>(
    `
      SELECT
        id,
        user_id,
        target_minutes,
        actual_word_count,
        estimated_seconds,
        scheduled_for,
        generated_at,
        status,
        overview,
        prompt_version,
        model_version,
        created_at,
        updated_at
      FROM briefings
      WHERE id = $1 AND user_id = $2
    `,
    [briefingId, userId],
  );
  const briefing = briefingResult.rows[0];
  if (briefing === undefined) {
    return null;
  }

  const itemResult = await database.query<BriefingItemRow>(
    `
      SELECT
        id,
        briefing_id,
        candidate_update_id,
        story_cluster_id,
        user_interest_id,
        position,
        headline,
        takeaway,
        why_it_matters,
        what_changed,
        estimated_seconds,
        ranking_json,
        grounding_json,
        created_at
      FROM briefing_items
      WHERE briefing_id = $1 AND user_id = $2
      ORDER BY position
    `,
    [briefingId, userId],
  );

  return CanonicalBriefingSchema.parse({
    id: briefing.id,
    userId: briefing.user_id,
    targetMinutes: briefing.target_minutes,
    actualWordCount: briefing.actual_word_count,
    estimatedSeconds: briefing.estimated_seconds,
    scheduledFor: toIsoString(briefing.scheduled_for),
    generatedAt: toIsoString(briefing.generated_at),
    status: briefing.status,
    overview: briefing.overview,
    promptVersion: briefing.prompt_version,
    modelVersion: briefing.model_version,
    items: itemResult.rows.map((item) => ({
      id: item.id,
      briefingId: item.briefing_id,
      storyClusterId: item.story_cluster_id,
      candidateUpdateId: item.candidate_update_id,
      userInterestId: item.user_interest_id,
      position: item.position,
      headline: item.headline,
      takeaway: item.takeaway,
      whyItMatters: item.why_it_matters,
      whatChanged: item.what_changed,
      estimatedSeconds: item.estimated_seconds,
      ranking: item.ranking_json,
      claims: item.grounding_json,
      createdAt: toIsoString(item.created_at),
    })),
    createdAt: toIsoString(briefing.created_at),
    updatedAt: toIsoString(briefing.updated_at),
  });
};

export class PostgresBriefingRepository implements BriefingRepository {
  public constructor(private readonly pool: Pool) {}

  public async saveCanonicalBriefing(
    userId: string,
    input: unknown,
  ): Promise<CanonicalBriefing> {
    const command = SaveCanonicalBriefingCommandSchema.parse(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const requestInsert = await client.query<{ id: string }>(
        `
          INSERT INTO briefing_generation_requests (
            user_id,
            idempotency_key,
            request_hash,
            status
          )
          VALUES ($1, $2, $3, 'processing')
          ON CONFLICT (user_id, idempotency_key) DO NOTHING
          RETURNING id
        `,
        [userId, command.idempotencyKey, command.requestHash],
      );

      if (requestInsert.rows[0] === undefined) {
        const existingRequest = await client.query<GenerationRequestRow>(
          `
            SELECT request_hash, status, briefing_id
            FROM briefing_generation_requests
            WHERE user_id = $1 AND idempotency_key = $2
            FOR UPDATE
          `,
          [userId, command.idempotencyKey],
        );
        const request = existingRequest.rows[0];
        if (request === undefined) {
          throw new Error("The generation idempotency record disappeared.");
        }
        if (request.request_hash !== command.requestHash) {
          throw new IdempotencyConflictError(
            "The briefing idempotency key was reused with different input.",
          );
        }
        if (request.status !== "completed" || request.briefing_id === null) {
          throw new Error("The briefing generation request is incomplete.");
        }
        const existing = await loadBriefing(
          client,
          userId,
          request.briefing_id,
        );
        if (existing === null) {
          throw new Error("The idempotent briefing record was not found.");
        }
        await client.query("COMMIT");
        return existing;
      }

      const briefing = command.briefing;
      const briefingInsert = await client.query<{ id: string }>(
        `
          INSERT INTO briefings (
            user_id,
            target_minutes,
            actual_word_count,
            estimated_seconds,
            scheduled_for,
            generated_at,
            status,
            overview,
            prompt_version,
            model_version
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `,
        [
          userId,
          briefing.targetMinutes,
          briefing.actualWordCount,
          briefing.estimatedSeconds,
          briefing.scheduledFor,
          briefing.generatedAt,
          briefing.status,
          briefing.overview,
          briefing.promptVersion,
          briefing.modelVersion,
        ],
      );
      const briefingId = briefingInsert.rows[0]?.id;
      if (briefingId === undefined) {
        throw new Error("Failed to store the canonical briefing.");
      }

      for (const item of briefing.items) {
        await client.query(
          `
            INSERT INTO briefing_items (
              briefing_id,
              user_id,
              candidate_update_id,
              story_cluster_id,
              user_interest_id,
              position,
              headline,
              takeaway,
              why_it_matters,
              what_changed,
              estimated_seconds,
              ranking_json,
              grounding_json
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12::JSONB, $13::JSONB
            )
          `,
          [
            briefingId,
            userId,
            item.candidateUpdateId,
            item.storyClusterId,
            item.userInterestId,
            item.position,
            item.headline,
            item.takeaway,
            item.whyItMatters,
            item.whatChanged,
            item.estimatedSeconds,
            JSON.stringify(item.ranking),
            JSON.stringify(item.claims),
          ],
        );
      }

      await client.query(
        `
          UPDATE briefing_generation_requests
          SET
            status = 'completed',
            briefing_id = $3,
            completed_at = NOW()
          WHERE user_id = $1 AND idempotency_key = $2
        `,
        [userId, command.idempotencyKey, briefingId],
      );

      const stored = await loadBriefing(client, userId, briefingId);
      if (stored === null) {
        throw new Error("Failed to reload the canonical briefing.");
      }
      await client.query("COMMIT");
      return stored;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public getBriefing(
    userId: string,
    briefingId: string,
  ): Promise<CanonicalBriefing | null> {
    return loadBriefing(this.pool, userId, briefingId);
  }

  public async getLatestBriefing(
    userId: string,
    availableAt: string,
  ): Promise<CanonicalBriefing | null> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM briefings
        WHERE
          user_id = $1
          AND scheduled_for <= $2
          AND status IN ('ready', 'delivered')
        ORDER BY scheduled_for DESC, id DESC
        LIMIT 1
      `,
      [userId, availableAt],
    );
    const briefingId = result.rows[0]?.id;
    return briefingId === undefined
      ? null
      : loadBriefing(this.pool, userId, briefingId);
  }

  public async getBriefingByGenerationKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<CanonicalBriefing | null> {
    const result = await this.pool.query<{ briefing_id: string }>(
      `
        SELECT briefing_id
        FROM briefing_generation_requests
        WHERE
          user_id = $1
          AND idempotency_key = $2
          AND status = 'completed'
          AND briefing_id IS NOT NULL
      `,
      [userId, idempotencyKey],
    );
    const briefingId = result.rows[0]?.briefing_id;
    return briefingId === undefined
      ? null
      : loadBriefing(this.pool, userId, briefingId);
  }

  public async recordInteraction(
    userId: string,
    briefingId: string,
    briefingItemId: string,
    input: unknown,
  ): Promise<BriefingInteraction | null> {
    const interaction = CreateBriefingInteractionSchema.parse(input);
    const occurredAt = interaction.occurredAt ?? new Date().toISOString();
    const requestHash = hashInteractionRequest({
      briefingId,
      briefingItemId,
      eventType: interaction.eventType,
      value: interaction.value,
      occurredAt: interaction.occurredAt ?? null,
    });
    const ownership = await this.pool.query<{ id: string }>(
      `
        SELECT item.id
        FROM briefing_items item
        INNER JOIN briefings briefing ON briefing.id = item.briefing_id
        WHERE
          item.id = $1
          AND item.briefing_id = $2
          AND item.user_id = $3
          AND briefing.user_id = $3
      `,
      [briefingItemId, briefingId, userId],
    );
    if (ownership.rows[0] === undefined) {
      return null;
    }

    const inserted = await this.pool.query<InteractionRow>(
      `
        INSERT INTO interactions (
          user_id,
          briefing_item_id,
          event_type,
          value_json,
          occurred_at,
          idempotency_key,
          request_hash
        )
        VALUES ($1, $2, $3, $4::JSONB, $5, $6, $7)
        ON CONFLICT (user_id, idempotency_key) DO NOTHING
        RETURNING
          id,
          user_id,
          briefing_item_id,
          event_type,
          value_json,
          occurred_at,
          idempotency_key,
          request_hash,
          created_at
      `,
      [
        userId,
        briefingItemId,
        interaction.eventType,
        JSON.stringify(interaction.value),
        occurredAt,
        interaction.idempotencyKey,
        requestHash,
      ],
    );
    const insertedRow = inserted.rows[0];
    if (insertedRow !== undefined) {
      return mapInteraction(insertedRow);
    }

    const existing = await this.pool.query<InteractionRow>(
      `
        SELECT
          id,
          user_id,
          briefing_item_id,
          event_type,
          value_json,
          occurred_at,
          idempotency_key,
          request_hash,
          created_at
        FROM interactions
        WHERE user_id = $1 AND idempotency_key = $2
      `,
      [userId, interaction.idempotencyKey],
    );
    const existingRow = existing.rows[0];
    if (existingRow === undefined) {
      throw new Error("The interaction idempotency record disappeared.");
    }
    if (existingRow.request_hash !== requestHash) {
      throw new IdempotencyConflictError(
        "The interaction idempotency key was reused with different input.",
      );
    }
    return mapInteraction(existingRow);
  }
}

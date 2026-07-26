import {
  BriefingItemStateListSchema,
  BriefingItemStateSchema,
  LibraryItemPageSchema,
  UpdateBriefingItemStateSchema,
  type BriefingItemState,
  type LibraryItemPage,
  type LibraryPageQuery,
  type UpdateBriefingItemState,
} from "@tempo/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export type LibraryKind = "saved" | "deferred";

export type UpdateItemStateResult =
  | { found: false; state: null }
  | { found: true; state: BriefingItemState | null };

export type LibraryRepository = {
  updateItemState(
    userId: string,
    briefingItemId: string,
    input: UpdateBriefingItemState,
  ): Promise<UpdateItemStateResult>;
  listBriefingItemStates(
    userId: string,
    briefingId: string,
  ): Promise<BriefingItemState[]>;
  listItems(
    userId: string,
    kind: LibraryKind,
    query: LibraryPageQuery,
  ): Promise<LibraryItemPage>;
};

type StateRow = QueryResultRow & {
  id: string;
  briefing_item_id: string;
  saved_at: Date | string | null;
  deferred_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type LibraryRow = StateRow & {
  briefing_id: string;
  scheduled_for: Date | string;
  generated_at: Date | string;
  status: "ready" | "delivered" | "archived";
  overview: string;
  target_minutes: number;
  briefing_estimated_seconds: number;
  item_count: number;
  candidate_update_id: string;
  story_cluster_id: string;
  user_interest_id: string;
  position: number;
  headline: string;
  takeaway: string;
  why_it_matters: string;
  what_changed: string;
  item_estimated_seconds: number;
  ranking_json: unknown;
  grounding_json: unknown;
  item_created_at: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null): string | null =>
  value === null ? null : toIsoString(value);

const mapState = (row: StateRow): BriefingItemState =>
  BriefingItemStateSchema.parse({
    id: row.id,
    briefingItemId: row.briefing_item_id,
    savedAt: toNullableIsoString(row.saved_at),
    deferredAt: toNullableIsoString(row.deferred_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });

const selectState = async (
  client: Pool | PoolClient,
  userId: string,
  briefingItemId: string,
): Promise<StateRow | undefined> => {
  const result = await client.query<StateRow>(
    `
      SELECT
        id,
        briefing_item_id,
        saved_at,
        deferred_at,
        created_at,
        updated_at
      FROM briefing_item_states
      WHERE user_id = $1 AND briefing_item_id = $2
    `,
    [userId, briefingItemId],
  );
  return result.rows[0];
};

export class PostgresLibraryRepository implements LibraryRepository {
  public constructor(private readonly pool: Pool) {}

  public async updateItemState(
    userId: string,
    briefingItemId: string,
    rawInput: UpdateBriefingItemState,
  ): Promise<UpdateItemStateResult> {
    const input = UpdateBriefingItemStateSchema.parse(rawInput);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const ownership = await client.query(
        `
          SELECT id
          FROM briefing_items
          WHERE id = $1 AND user_id = $2
          FOR UPDATE
        `,
        [briefingItemId, userId],
      );
      if (ownership.rows[0] === undefined) {
        await client.query("COMMIT");
        return { found: false, state: null };
      }
      const existing = await client.query<StateRow>(
        `
          SELECT
            id,
            briefing_item_id,
            saved_at,
            deferred_at,
            created_at,
            updated_at
          FROM briefing_item_states
          WHERE user_id = $1 AND briefing_item_id = $2
          FOR UPDATE
        `,
        [userId, briefingItemId],
      );
      const row = existing.rows[0];
      const now = new Date().toISOString();
      const savedAt =
        input.saved === undefined
          ? (row?.saved_at ?? null)
          : input.saved
            ? now
            : null;
      const deferredAt =
        input.deferred === undefined
          ? (row?.deferred_at ?? null)
          : input.deferred
            ? now
            : null;

      if (savedAt === null && deferredAt === null) {
        if (row !== undefined) {
          await client.query(
            `
              DELETE FROM briefing_item_states
              WHERE user_id = $1 AND briefing_item_id = $2
            `,
            [userId, briefingItemId],
          );
        }
        await client.query("COMMIT");
        return { found: true, state: null };
      }

      await client.query(
        `
          INSERT INTO briefing_item_states (
            user_id,
            briefing_item_id,
            saved_at,
            deferred_at
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, briefing_item_id) DO UPDATE
          SET
            saved_at = EXCLUDED.saved_at,
            deferred_at = EXCLUDED.deferred_at,
            updated_at = NOW()
        `,
        [userId, briefingItemId, savedAt, deferredAt],
      );
      const stored = await selectState(client, userId, briefingItemId);
      if (stored === undefined) {
        throw new Error("Failed to load the updated briefing item state.");
      }
      await client.query("COMMIT");
      return { found: true, state: mapState(stored) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async listBriefingItemStates(
    userId: string,
    briefingId: string,
  ): Promise<BriefingItemState[]> {
    const result = await this.pool.query<StateRow>(
      `
        SELECT
          state.id,
          state.briefing_item_id,
          state.saved_at,
          state.deferred_at,
          state.created_at,
          state.updated_at
        FROM briefing_item_states state
        INNER JOIN briefing_items item
          ON item.id = state.briefing_item_id
        WHERE
          state.user_id = $1
          AND item.user_id = $1
          AND item.briefing_id = $2
        ORDER BY item.position
      `,
      [userId, briefingId],
    );
    return BriefingItemStateListSchema.parse({
      items: result.rows.map(mapState),
    }).items;
  }

  public async listItems(
    userId: string,
    kind: LibraryKind,
    query: LibraryPageQuery,
  ): Promise<LibraryItemPage> {
    const stateColumn = kind === "saved" ? "saved_at" : "deferred_at";
    const result = await this.pool.query<LibraryRow>(
      `
        SELECT
          state.id,
          state.briefing_item_id,
          state.saved_at,
          state.deferred_at,
          state.created_at,
          state.updated_at,
          briefing.id AS briefing_id,
          briefing.scheduled_for,
          briefing.generated_at,
          briefing.status,
          briefing.overview,
          briefing.target_minutes,
          briefing.estimated_seconds AS briefing_estimated_seconds,
          (
            SELECT COUNT(*)::INTEGER
            FROM briefing_items count_item
            WHERE count_item.briefing_id = briefing.id
          ) AS item_count,
          item.candidate_update_id,
          item.story_cluster_id,
          item.user_interest_id,
          item.position,
          item.headline,
          item.takeaway,
          item.why_it_matters,
          item.what_changed,
          item.estimated_seconds AS item_estimated_seconds,
          item.ranking_json,
          item.grounding_json,
          item.created_at AS item_created_at
        FROM briefing_item_states state
        INNER JOIN briefing_items item
          ON item.id = state.briefing_item_id AND item.user_id = state.user_id
        INNER JOIN briefings briefing
          ON briefing.id = item.briefing_id AND briefing.user_id = state.user_id
        WHERE
          state.user_id = $1
          AND state.${stateColumn} IS NOT NULL
          AND (
            $2::UUID IS NULL
            OR (state.${stateColumn}, state.id) < (
              SELECT cursor_state.${stateColumn}, cursor_state.id
              FROM briefing_item_states cursor_state
              WHERE cursor_state.id = $2 AND cursor_state.user_id = $1
            )
          )
        ORDER BY state.${stateColumn} DESC, state.id DESC
        LIMIT $3
      `,
      [userId, query.cursor ?? null, query.limit + 1],
    );
    const hasNextPage = result.rows.length > query.limit;
    const rows = result.rows.slice(0, query.limit);
    return LibraryItemPageSchema.parse({
      items: rows.map((row) => ({
        state: mapState(row),
        briefing: {
          id: row.briefing_id,
          scheduledFor: toIsoString(row.scheduled_for),
          generatedAt: toIsoString(row.generated_at),
          status: row.status,
          overview: row.overview,
          targetMinutes: row.target_minutes,
          estimatedSeconds: row.briefing_estimated_seconds,
          itemCount: row.item_count,
        },
        item: {
          id: row.briefing_item_id,
          briefingId: row.briefing_id,
          storyClusterId: row.story_cluster_id,
          candidateUpdateId: row.candidate_update_id,
          userInterestId: row.user_interest_id,
          position: row.position,
          headline: row.headline,
          takeaway: row.takeaway,
          whyItMatters: row.why_it_matters,
          whatChanged: row.what_changed,
          estimatedSeconds: row.item_estimated_seconds,
          ranking: row.ranking_json,
          claims: row.grounding_json,
          createdAt: toIsoString(row.item_created_at),
        },
      })),
      nextCursor:
        hasNextPage && rows.at(-1) !== undefined ? rows.at(-1)?.id : null,
    });
  }
}

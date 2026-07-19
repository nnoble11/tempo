import type {
  NormalizedSourceItem,
  Source,
  SourceItemUpsertResult,
  SourceRegistration,
  StoredSourceItem,
} from "@tempo/contracts";
import type { Pool, QueryResultRow } from "pg";

export type ListSourceItemsQuery = {
  limit: number;
};

export type ClaimedSource = {
  source: SourceRegistration;
  etag: string | null;
  lastModified: string | null;
  consecutiveFailures: number;
};

export type ClaimDueSourcesCommand = {
  workerId: string;
  now: string;
  leaseUntil: string;
  sourceKeys: readonly string[];
  limit: number;
};

export type RecordSourceFetchSuccessCommand = {
  sourceKey: string;
  workerId: string;
  fetchedAt: string;
  nextFetchAt: string;
  etag: string | null;
  lastModified: string | null;
};

export type RecordSourceFetchFailureCommand = {
  sourceKey: string;
  workerId: string;
  attemptedAt: string;
  nextFetchAt: string;
  error: string;
};

export type SourceRepository = {
  registerSource(registration: SourceRegistration): Promise<Source>;
  claimDueSources(command: ClaimDueSourcesCommand): Promise<ClaimedSource[]>;
  recordSourceFetchSuccess(
    command: RecordSourceFetchSuccessCommand,
  ): Promise<void>;
  recordSourceFetchFailure(
    command: RecordSourceFetchFailureCommand,
  ): Promise<void>;
  upsertSourceItems(
    sourceKey: string,
    items: readonly NormalizedSourceItem[],
  ): Promise<SourceItemUpsertResult>;
  listSourceItems(
    sourceKey: string,
    query: ListSourceItemsQuery,
  ): Promise<StoredSourceItem[]>;
};

type SourceRow = QueryResultRow & {
  id: string;
  key: string;
  name: string;
  homepage_url: string;
  feed_url: string;
  adapter_kind: "rss" | "atom" | "json_api";
  default_language: string;
  fetch_interval_minutes: number;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type SourceItemRow = QueryResultRow & {
  id: string;
  source_id: string;
  source_key: string;
  external_id: string;
  canonical_url: string;
  title: string;
  author: string | null;
  published_at: Date | string | null;
  discovered_at: Date | string;
  language: string;
  excerpt: string | null;
  content_hash: string;
  metadata_json: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

type OutcomeRow = QueryResultRow & {
  outcome: "inserted" | "updated" | "unchanged";
};

type ClaimedSourceRow = QueryResultRow & {
  key: string;
  name: string;
  homepage_url: string;
  feed_url: string;
  adapter_kind: "rss" | "atom" | "json_api";
  default_language: string;
  fetch_interval_minutes: number;
  etag: string | null;
  last_modified: string | null;
  consecutive_failures: number;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toMetadata = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...value }
    : {};

const mapSource = (row: SourceRow): Source => ({
  id: row.id,
  key: row.key,
  name: row.name,
  homepageUrl: row.homepage_url,
  feedUrl: row.feed_url,
  adapterKind: row.adapter_kind,
  defaultLanguage: row.default_language,
  fetchIntervalMinutes: row.fetch_interval_minutes,
  active: row.active,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapSourceItem = (row: SourceItemRow): StoredSourceItem => ({
  id: row.id,
  sourceId: row.source_id,
  sourceKey: row.source_key,
  externalId: row.external_id,
  canonicalUrl: row.canonical_url,
  title: row.title,
  author: row.author,
  publishedAt: row.published_at === null ? null : toIsoString(row.published_at),
  discoveredAt: toIsoString(row.discovered_at),
  language: row.language,
  excerpt: row.excerpt,
  contentHash: row.content_hash,
  metadata: toMetadata(row.metadata_json),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

export class PostgresSourceRepository implements SourceRepository {
  public constructor(private readonly pool: Pool) {}

  public async registerSource(
    registration: SourceRegistration,
  ): Promise<Source> {
    const result = await this.pool.query<SourceRow>(
      `
        INSERT INTO sources (
          key,
          name,
          homepage_url,
          feed_url,
          adapter_kind,
          default_language,
          fetch_interval_minutes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (key) DO UPDATE
        SET
          name = EXCLUDED.name,
          homepage_url = EXCLUDED.homepage_url,
          feed_url = EXCLUDED.feed_url,
          adapter_kind = EXCLUDED.adapter_kind,
          default_language = EXCLUDED.default_language,
          fetch_interval_minutes = EXCLUDED.fetch_interval_minutes,
          updated_at = NOW()
        RETURNING
          id,
          key,
          name,
          homepage_url,
          feed_url,
          adapter_kind,
          default_language,
          fetch_interval_minutes,
          active,
          created_at,
          updated_at
      `,
      [
        registration.key,
        registration.name,
        registration.homepageUrl,
        registration.feedUrl,
        registration.adapterKind,
        registration.defaultLanguage,
        registration.fetchIntervalMinutes,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error("Failed to register the source.");
    }
    return mapSource(row);
  }

  public async claimDueSources(
    command: ClaimDueSourcesCommand,
  ): Promise<ClaimedSource[]> {
    if (command.sourceKeys.length === 0 || command.limit === 0) {
      return [];
    }

    const result = await this.pool.query<ClaimedSourceRow>(
      `
        WITH due AS (
          SELECT id
          FROM sources
          WHERE
            active
            AND key = ANY($1::TEXT[])
            AND next_fetch_at <= $2
            AND (
              fetch_lease_until IS NULL
              OR fetch_lease_until <= $2
            )
          ORDER BY next_fetch_at, key
          FOR UPDATE SKIP LOCKED
          LIMIT $3
        ),
        claimed AS (
          UPDATE sources source
          SET
            fetch_lease_owner = $4,
            fetch_lease_until = $5,
            updated_at = NOW()
          FROM due
          WHERE source.id = due.id
          RETURNING
            source.key,
            source.name,
            source.homepage_url,
            source.feed_url,
            source.adapter_kind,
            source.default_language,
            source.fetch_interval_minutes,
            source.etag,
            source.last_modified,
            source.consecutive_failures,
            source.next_fetch_at
        )
        SELECT
          key,
          name,
          homepage_url,
          feed_url,
          adapter_kind,
          default_language,
          fetch_interval_minutes,
          etag,
          last_modified,
          consecutive_failures
        FROM claimed
        ORDER BY next_fetch_at, key
      `,
      [
        command.sourceKeys,
        command.now,
        command.limit,
        command.workerId,
        command.leaseUntil,
      ],
    );

    return result.rows.map((row) => ({
      source: {
        key: row.key,
        name: row.name,
        homepageUrl: row.homepage_url,
        feedUrl: row.feed_url,
        adapterKind: row.adapter_kind,
        defaultLanguage: row.default_language,
        fetchIntervalMinutes: row.fetch_interval_minutes,
      },
      etag: row.etag,
      lastModified: row.last_modified,
      consecutiveFailures: row.consecutive_failures,
    }));
  }

  public async recordSourceFetchSuccess(
    command: RecordSourceFetchSuccessCommand,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE sources
        SET
          etag = $3,
          last_modified = $4,
          last_fetched_at = $5,
          last_success_at = $5,
          consecutive_failures = 0,
          next_fetch_at = $6,
          fetch_lease_owner = NULL,
          fetch_lease_until = NULL,
          last_error = NULL,
          updated_at = NOW()
        WHERE key = $1 AND fetch_lease_owner = $2
      `,
      [
        command.sourceKey,
        command.workerId,
        command.etag,
        command.lastModified,
        command.fetchedAt,
        command.nextFetchAt,
      ],
    );
    if (result.rowCount !== 1) {
      throw new Error(`Source fetch lease was lost for ${command.sourceKey}.`);
    }
  }

  public async recordSourceFetchFailure(
    command: RecordSourceFetchFailureCommand,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE sources
        SET
          last_fetched_at = $3,
          consecutive_failures = consecutive_failures + 1,
          next_fetch_at = $4,
          fetch_lease_owner = NULL,
          fetch_lease_until = NULL,
          last_error = $5,
          updated_at = NOW()
        WHERE key = $1 AND fetch_lease_owner = $2
      `,
      [
        command.sourceKey,
        command.workerId,
        command.attemptedAt,
        command.nextFetchAt,
        command.error.slice(0, 2_000),
      ],
    );
    if (result.rowCount !== 1) {
      throw new Error(`Source fetch lease was lost for ${command.sourceKey}.`);
    }
  }

  public async upsertSourceItems(
    sourceKey: string,
    items: readonly NormalizedSourceItem[],
  ): Promise<SourceItemUpsertResult> {
    if (items.some((item) => item.sourceKey !== sourceKey)) {
      throw new Error("Every source item must match the requested source key.");
    }

    const client = await this.pool.connect();
    const result: SourceItemUpsertResult = {
      inserted: 0,
      updated: 0,
      unchanged: 0,
    };

    try {
      await client.query("BEGIN");
      for (const item of items) {
        const outcomeResult = await client.query<OutcomeRow>(
          `
            WITH source_record AS (
              SELECT id FROM sources WHERE key = $1
            ),
            existing AS (
              SELECT si.content_hash
              FROM source_items si
              INNER JOIN source_record source ON source.id = si.source_id
              WHERE si.external_id = $2
            ),
            upserted AS (
              INSERT INTO source_items (
                source_id,
                external_id,
                canonical_url,
                title,
                author,
                published_at,
                discovered_at,
                language,
                excerpt,
                content_hash,
                metadata_json
              )
              SELECT
                source_record.id,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11::JSONB
              FROM source_record
              ON CONFLICT (source_id, external_id) DO UPDATE
              SET
                canonical_url = EXCLUDED.canonical_url,
                title = EXCLUDED.title,
                author = EXCLUDED.author,
                published_at = EXCLUDED.published_at,
                discovered_at = LEAST(
                  source_items.discovered_at,
                  EXCLUDED.discovered_at
                ),
                language = EXCLUDED.language,
                excerpt = EXCLUDED.excerpt,
                content_hash = EXCLUDED.content_hash,
                metadata_json = EXCLUDED.metadata_json,
                updated_at = NOW()
              WHERE source_items.content_hash IS DISTINCT FROM EXCLUDED.content_hash
              RETURNING id
            )
            SELECT
              CASE
                WHEN NOT EXISTS (SELECT 1 FROM existing) THEN 'inserted'
                WHEN (SELECT content_hash FROM existing) = $10 THEN 'unchanged'
                ELSE 'updated'
              END AS outcome
            FROM source_record
          `,
          [
            sourceKey,
            item.externalId,
            item.canonicalUrl,
            item.title,
            item.author,
            item.publishedAt,
            item.discoveredAt,
            item.language,
            item.excerpt,
            item.contentHash,
            JSON.stringify(item.metadata),
          ],
        );
        const outcome = outcomeResult.rows[0]?.outcome;
        if (outcome === undefined) {
          throw new Error(`Unknown source: ${sourceKey}`);
        }
        result[outcome] += 1;
      }
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async listSourceItems(
    sourceKey: string,
    query: ListSourceItemsQuery,
  ): Promise<StoredSourceItem[]> {
    const result = await this.pool.query<SourceItemRow>(
      `
        SELECT
          si.id,
          si.source_id,
          source.key AS source_key,
          si.external_id,
          si.canonical_url,
          si.title,
          si.author,
          si.published_at,
          si.discovered_at,
          si.language,
          si.excerpt,
          si.content_hash,
          si.metadata_json,
          si.created_at,
          si.updated_at
        FROM source_items si
        INNER JOIN sources source ON source.id = si.source_id
        WHERE source.key = $1
        ORDER BY
          COALESCE(si.published_at, si.discovered_at) DESC,
          si.id DESC
        LIMIT $2
      `,
      [sourceKey, query.limit],
    );
    return result.rows.map(mapSourceItem);
  }
}

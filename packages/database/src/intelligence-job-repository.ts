import type { Pool, QueryResultRow } from "pg";

export type ClaimedIntelligenceJob = {
  id: string;
  sourceItemId: string;
  sourceKey: string;
  publisher: string;
  canonicalUrl: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  language: string;
  contentHash: string;
  attemptCount: number;
};

export type IntelligenceJobRepository = {
  claimJobs(command: {
    workerId: string;
    now: string;
    leaseUntil: string;
    limit: number;
  }): Promise<ClaimedIntelligenceJob[]>;
  completeJob(command: {
    jobId: string;
    workerId: string;
    clusterId: string;
    completedAt: string;
  }): Promise<void>;
  failJob(command: {
    jobId: string;
    workerId: string;
    error: string;
    failedAt: string;
    nextAttemptAt: string | null;
  }): Promise<void>;
};

type JobRow = QueryResultRow & {
  id: string;
  source_item_id: string;
  source_key: string;
  publisher: string;
  canonical_url: string;
  title: string;
  excerpt: string | null;
  published_at: Date | string | null;
  discovered_at: Date | string;
  language: string;
  content_hash: string;
  attempt_count: number;
};

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export class PostgresIntelligenceJobRepository implements IntelligenceJobRepository {
  public constructor(private readonly pool: Pool) {}

  public async claimJobs(command: {
    workerId: string;
    now: string;
    leaseUntil: string;
    limit: number;
  }): Promise<ClaimedIntelligenceJob[]> {
    const result = await this.pool.query<JobRow>(
      `
        WITH claimable AS (
          SELECT id
          FROM story_intelligence_jobs
          WHERE
            (
              status IN ('queued', 'failed')
              AND next_attempt_at <= $2::TIMESTAMPTZ
            )
            OR (
              status = 'processing'
              AND lease_expires_at <= $2::TIMESTAMPTZ
            )
          ORDER BY next_attempt_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT $4
        ),
        claimed AS (
          UPDATE story_intelligence_jobs job
          SET
            status = 'processing',
            worker_id = $1,
            lease_expires_at = $3,
            attempt_count = job.attempt_count + 1,
            updated_at = $2
          FROM claimable
          WHERE job.id = claimable.id
          RETURNING job.id, job.source_item_id, job.attempt_count
        )
        SELECT
          claimed.id,
          item.id AS source_item_id,
          source.key AS source_key,
          source.name AS publisher,
          item.canonical_url,
          item.title,
          item.excerpt,
          item.published_at,
          item.discovered_at,
          item.language,
          item.content_hash,
          claimed.attempt_count
        FROM claimed
        INNER JOIN source_items item ON item.id = claimed.source_item_id
        INNER JOIN sources source ON source.id = item.source_id
        ORDER BY claimed.id
      `,
      [command.workerId, command.now, command.leaseUntil, command.limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      sourceItemId: row.source_item_id,
      sourceKey: row.source_key,
      publisher: row.publisher,
      canonicalUrl: row.canonical_url,
      title: row.title,
      excerpt: row.excerpt,
      publishedAt: row.published_at === null ? null : iso(row.published_at),
      discoveredAt: iso(row.discovered_at),
      language: row.language,
      contentHash: row.content_hash,
      attemptCount: row.attempt_count,
    }));
  }

  public async completeJob(command: {
    jobId: string;
    workerId: string;
    clusterId: string;
    completedAt: string;
  }): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE story_intelligence_jobs
        SET
          status = 'completed',
          cluster_id = $3,
          worker_id = NULL,
          lease_expires_at = NULL,
          next_attempt_at = $4,
          last_error = NULL,
          completed_at = $4,
          updated_at = $4
        WHERE id = $1 AND status = 'processing' AND worker_id = $2
      `,
      [command.jobId, command.workerId, command.clusterId, command.completedAt],
    );
    if (result.rowCount !== 1) {
      throw new Error("The intelligence job lease was lost.");
    }
  }

  public async failJob(command: {
    jobId: string;
    workerId: string;
    error: string;
    failedAt: string;
    nextAttemptAt: string | null;
  }): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE story_intelligence_jobs
        SET
          status = 'failed',
          worker_id = NULL,
          lease_expires_at = NULL,
          next_attempt_at = COALESCE($3, 'infinity'::TIMESTAMPTZ),
          last_error = $4,
          updated_at = $5
        WHERE id = $1 AND status = 'processing' AND worker_id = $2
      `,
      [
        command.jobId,
        command.workerId,
        command.nextAttemptAt,
        command.error.slice(0, 2_000),
        command.failedAt,
      ],
    );
    if (result.rowCount !== 1) {
      throw new Error("The intelligence job lease was lost.");
    }
  }
}

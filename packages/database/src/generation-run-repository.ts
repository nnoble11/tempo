import {
  ScheduledBriefingRunSchema,
  type ScheduledBriefingRun,
} from "@tempo/contracts";
import type { Pool, QueryResultRow } from "pg";

export type ClaimDueScheduledBriefingRunsCommand = {
  workerId: string;
  now: string;
  leaseUntil: string;
  limit: number;
};

export type CompleteScheduledBriefingRunCommand = {
  runId: string;
  workerId: string;
  briefingId: string;
  candidateCount: number;
  selectedCount: number;
  completedAt: string;
};

export type AttachScheduledBriefingCommand = {
  runId: string;
  workerId: string;
  briefingId: string;
  candidateCount: number;
  selectedCount: number;
  attachedAt: string;
};

export type SkipScheduledBriefingRunCommand = {
  runId: string;
  workerId: string;
  candidateCount: number;
  reason: string;
  completedAt: string;
};

export type FailScheduledBriefingRunCommand = {
  runId: string;
  workerId: string;
  candidateCount: number;
  error: string;
  failedAt: string;
  nextAttemptAt: string | null;
};

export type ScheduledBriefingRunRepository = {
  claimDueRuns(
    command: ClaimDueScheduledBriefingRunsCommand,
  ): Promise<ScheduledBriefingRun[]>;
  attachBriefing(command: AttachScheduledBriefingCommand): Promise<void>;
  completeRun(command: CompleteScheduledBriefingRunCommand): Promise<void>;
  skipRun(command: SkipScheduledBriefingRunCommand): Promise<void>;
  failRun(command: FailScheduledBriefingRunCommand): Promise<void>;
  getRun(runId: string): Promise<ScheduledBriefingRun | null>;
};

type ScheduledBriefingRunRow = QueryResultRow & {
  id: string;
  user_id: string;
  local_date: Date | string;
  scheduled_for: Date | string;
  status: "queued" | "processing" | "completed" | "skipped" | "failed";
  attempt_count: number;
  candidate_count: number;
  selected_count: number;
  briefing_id: string | null;
  worker_id: string | null;
  lease_expires_at: Date | string | null;
  next_attempt_at: Date | string | null;
  last_error: string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null): string | null =>
  value === null ? null : toIsoString(value);

const toLocalDate = (value: Date | string): string => {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
};

const mapRun = (row: ScheduledBriefingRunRow): ScheduledBriefingRun =>
  ScheduledBriefingRunSchema.parse({
    id: row.id,
    userId: row.user_id,
    localDate: toLocalDate(row.local_date),
    scheduledFor: toIsoString(row.scheduled_for),
    status: row.status,
    attemptCount: row.attempt_count,
    candidateCount: row.candidate_count,
    selectedCount: row.selected_count,
    briefingId: row.briefing_id,
    workerId: row.worker_id,
    leaseExpiresAt: toNullableIsoString(row.lease_expires_at),
    nextAttemptAt: toNullableIsoString(row.next_attempt_at),
    lastError: row.last_error,
    startedAt: toNullableIsoString(row.started_at),
    completedAt: toNullableIsoString(row.completed_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });

const runColumns = `
  id,
  user_id,
  local_date,
  scheduled_for,
  status,
  attempt_count,
  candidate_count,
  selected_count,
  briefing_id,
  worker_id,
  lease_expires_at,
  next_attempt_at,
  last_error,
  started_at,
  completed_at,
  created_at,
  updated_at
`;

const returningRunColumns = `
  run.id,
  run.user_id,
  run.local_date,
  run.scheduled_for,
  run.status,
  run.attempt_count,
  run.candidate_count,
  run.selected_count,
  run.briefing_id,
  run.worker_id,
  run.lease_expires_at,
  run.next_attempt_at,
  run.last_error,
  run.started_at,
  run.completed_at,
  run.created_at,
  run.updated_at
`;

const requireClaimedUpdate = (rowCount: number | null): void => {
  if (rowCount !== 1) {
    throw new Error("The scheduled briefing run lease was lost.");
  }
};

const validateClaimCommand = (
  command: ClaimDueScheduledBriefingRunsCommand,
): void => {
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
};

export class PostgresScheduledBriefingRunRepository implements ScheduledBriefingRunRepository {
  public constructor(private readonly pool: Pool) {}

  public async claimDueRuns(
    command: ClaimDueScheduledBriefingRunsCommand,
  ): Promise<ScheduledBriefingRun[]> {
    validateClaimCommand(command);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
          WITH eligible AS (
            SELECT
              app_user.id AS user_id,
              local_day.local_date,
              schedule.scheduled_for
            FROM users app_user
            INNER JOIN user_preferences preference
              ON preference.user_id = app_user.id
            CROSS JOIN LATERAL (
              SELECT (
                $1::TIMESTAMPTZ AT TIME ZONE preference.timezone
              )::DATE AS local_date
            ) local_day
            CROSS JOIN LATERAL (
              SELECT (
                local_day.local_date + preference.daily_briefing_time
              ) AT TIME ZONE preference.timezone AS scheduled_for
            ) schedule
            WHERE
              app_user.onboarding_completed_at IS NOT NULL
              AND schedule.scheduled_for <= $1::TIMESTAMPTZ
              AND NOT EXISTS (
                SELECT 1
                FROM scheduled_briefing_runs existing
                WHERE
                  existing.user_id = app_user.id
                  AND existing.local_date = local_day.local_date
              )
            ORDER BY schedule.scheduled_for, app_user.id
            LIMIT $2
          )
          INSERT INTO scheduled_briefing_runs (
            user_id,
            local_date,
            scheduled_for,
            status,
            next_attempt_at
          )
          SELECT
            user_id,
            local_date,
            scheduled_for,
            'queued',
            scheduled_for
          FROM eligible
          ON CONFLICT (user_id, local_date) DO NOTHING
        `,
        [command.now, command.limit * 4],
      );

      const claimed = await client.query<ScheduledBriefingRunRow>(
        `
          WITH claimable AS (
            SELECT id
            FROM scheduled_briefing_runs
            WHERE
              scheduled_for <= $2::TIMESTAMPTZ
              AND (
                status = 'queued'
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
          UPDATE scheduled_briefing_runs run
          SET
            status = 'processing',
            worker_id = $1,
            lease_expires_at = $3,
            next_attempt_at = NULL,
            attempt_count = run.attempt_count + 1,
            started_at = COALESCE(run.started_at, $2::TIMESTAMPTZ),
            updated_at = $2::TIMESTAMPTZ
          FROM claimable
          WHERE run.id = claimable.id
          RETURNING ${returningRunColumns}
        `,
        [command.workerId, command.now, command.leaseUntil, command.limit],
      );
      await client.query("COMMIT");
      return claimed.rows.map(mapRun);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async completeRun(
    command: CompleteScheduledBriefingRunCommand,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE scheduled_briefing_runs
        SET
          status = 'completed',
          briefing_id = $3,
          candidate_count = $4,
          selected_count = $5,
          worker_id = NULL,
          lease_expires_at = NULL,
          next_attempt_at = NULL,
          last_error = NULL,
          completed_at = $6,
          updated_at = $6
        WHERE id = $1 AND status = 'processing' AND worker_id = $2
      `,
      [
        command.runId,
        command.workerId,
        command.briefingId,
        command.candidateCount,
        command.selectedCount,
        command.completedAt,
      ],
    );
    requireClaimedUpdate(result.rowCount);
  }

  public async attachBriefing(
    command: AttachScheduledBriefingCommand,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE scheduled_briefing_runs
        SET
          briefing_id = $3,
          candidate_count = $4,
          selected_count = $5,
          updated_at = $6
        WHERE
          id = $1
          AND status = 'processing'
          AND worker_id = $2
          AND (briefing_id IS NULL OR briefing_id = $3)
      `,
      [
        command.runId,
        command.workerId,
        command.briefingId,
        command.candidateCount,
        command.selectedCount,
        command.attachedAt,
      ],
    );
    requireClaimedUpdate(result.rowCount);
  }

  public async skipRun(
    command: SkipScheduledBriefingRunCommand,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE scheduled_briefing_runs
        SET
          status = 'skipped',
          candidate_count = $3,
          selected_count = 0,
          worker_id = NULL,
          lease_expires_at = NULL,
          next_attempt_at = NULL,
          last_error = $4,
          completed_at = $5,
          updated_at = $5
        WHERE id = $1 AND status = 'processing' AND worker_id = $2
      `,
      [
        command.runId,
        command.workerId,
        command.candidateCount,
        command.reason.slice(0, 2_000),
        command.completedAt,
      ],
    );
    requireClaimedUpdate(result.rowCount);
  }

  public async failRun(
    command: FailScheduledBriefingRunCommand,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE scheduled_briefing_runs
        SET
          status = 'failed',
          candidate_count = $3,
          selected_count = 0,
          worker_id = NULL,
          lease_expires_at = NULL,
          next_attempt_at = $4,
          last_error = $5,
          completed_at = CASE
            WHEN $4::TIMESTAMPTZ IS NULL THEN $6::TIMESTAMPTZ
            ELSE NULL
          END,
          updated_at = $6
        WHERE id = $1 AND status = 'processing' AND worker_id = $2
      `,
      [
        command.runId,
        command.workerId,
        command.candidateCount,
        command.nextAttemptAt,
        command.error.slice(0, 2_000),
        command.failedAt,
      ],
    );
    requireClaimedUpdate(result.rowCount);
  }

  public async getRun(runId: string): Promise<ScheduledBriefingRun | null> {
    const result = await this.pool.query<ScheduledBriefingRunRow>(
      `
        SELECT ${runColumns}
        FROM scheduled_briefing_runs
        WHERE id = $1
      `,
      [runId],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapRun(row);
  }
}

CREATE TABLE scheduled_briefing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  selected_count INTEGER NOT NULL DEFAULT 0,
  briefing_id UUID,
  worker_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_briefing_runs_user_date_unique UNIQUE (
    user_id,
    local_date
  ),
  CONSTRAINT scheduled_briefing_runs_briefing_user_foreign FOREIGN KEY (
    briefing_id,
    user_id
  ) REFERENCES briefings(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT scheduled_briefing_runs_status_valid CHECK (
    status IN ('queued', 'processing', 'completed', 'skipped', 'failed')
  ),
  CONSTRAINT scheduled_briefing_runs_attempts_nonnegative CHECK (
    attempt_count >= 0
  ),
  CONSTRAINT scheduled_briefing_runs_counts_nonnegative CHECK (
    candidate_count >= 0
    AND selected_count >= 0
    AND selected_count <= candidate_count
  ),
  CONSTRAINT scheduled_briefing_runs_processing_lease_valid CHECK (
    (
      status = 'processing'
      AND worker_id IS NOT NULL
      AND lease_expires_at IS NOT NULL
    )
    OR (
      status <> 'processing'
      AND worker_id IS NULL
      AND lease_expires_at IS NULL
    )
  ),
  CONSTRAINT scheduled_briefing_runs_completion_valid CHECK (
    (
      status = 'completed'
      AND briefing_id IS NOT NULL
      AND completed_at IS NOT NULL
    )
    OR (
      status IN ('queued', 'skipped')
      AND briefing_id IS NULL
    )
    OR status IN ('processing', 'failed')
  ),
  CONSTRAINT scheduled_briefing_runs_error_length CHECK (
    last_error IS NULL OR LENGTH(last_error) <= 2000
  )
);

CREATE INDEX scheduled_briefing_runs_claim_index
  ON scheduled_briefing_runs (
    scheduled_for,
    next_attempt_at,
    lease_expires_at,
    id
  )
  WHERE status IN ('queued', 'processing', 'failed');

CREATE INDEX scheduled_briefing_runs_user_history_index
  ON scheduled_briefing_runs (user_id, local_date DESC, id DESC);

ALTER TABLE scheduled_briefing_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE scheduled_briefing_runs IS
  'Observable, lease-backed once-per-local-day canonical briefing generation.';

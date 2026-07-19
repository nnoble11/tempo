CREATE TABLE story_intelligence_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id UUID NOT NULL UNIQUE REFERENCES source_items(id) ON DELETE CASCADE,
  source_content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  worker_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cluster_id UUID REFERENCES story_clusters(id) ON DELETE SET NULL,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT story_intelligence_jobs_status_valid CHECK (
    status IN ('queued', 'processing', 'completed', 'failed')
  ),
  CONSTRAINT story_intelligence_jobs_hash_valid CHECK (
    source_content_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT story_intelligence_jobs_attempts_valid CHECK (attempt_count >= 0),
  CONSTRAINT story_intelligence_jobs_lease_valid CHECK (
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
  CONSTRAINT story_intelligence_jobs_error_length CHECK (
    last_error IS NULL OR LENGTH(last_error) <= 2000
  )
);

CREATE INDEX story_intelligence_jobs_claim_index
  ON story_intelligence_jobs (next_attempt_at, lease_expires_at, id)
  WHERE status IN ('queued', 'processing', 'failed');

CREATE OR REPLACE FUNCTION queue_story_intelligence_job()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO story_intelligence_jobs (
    source_item_id,
    source_content_hash,
    status,
    next_attempt_at
  )
  VALUES (NEW.id, NEW.content_hash, 'queued', NOW())
  ON CONFLICT (source_item_id) DO UPDATE
  SET
    source_content_hash = EXCLUDED.source_content_hash,
    status = CASE
      WHEN story_intelligence_jobs.source_content_hash
        IS DISTINCT FROM EXCLUDED.source_content_hash
      THEN 'queued'
      ELSE story_intelligence_jobs.status
    END,
    attempt_count = CASE
      WHEN story_intelligence_jobs.source_content_hash
        IS DISTINCT FROM EXCLUDED.source_content_hash
      THEN 0
      ELSE story_intelligence_jobs.attempt_count
    END,
    worker_id = NULL,
    lease_expires_at = NULL,
    next_attempt_at = CASE
      WHEN story_intelligence_jobs.source_content_hash
        IS DISTINCT FROM EXCLUDED.source_content_hash
      THEN NOW()
      ELSE story_intelligence_jobs.next_attempt_at
    END,
    cluster_id = CASE
      WHEN story_intelligence_jobs.source_content_hash
        IS DISTINCT FROM EXCLUDED.source_content_hash
      THEN NULL
      ELSE story_intelligence_jobs.cluster_id
    END,
    last_error = CASE
      WHEN story_intelligence_jobs.source_content_hash
        IS DISTINCT FROM EXCLUDED.source_content_hash
      THEN NULL
      ELSE story_intelligence_jobs.last_error
    END,
    completed_at = CASE
      WHEN story_intelligence_jobs.source_content_hash
        IS DISTINCT FROM EXCLUDED.source_content_hash
      THEN NULL
      ELSE story_intelligence_jobs.completed_at
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER source_items_queue_story_intelligence
AFTER INSERT OR UPDATE OF content_hash
ON source_items
FOR EACH ROW
EXECUTE FUNCTION queue_story_intelligence_job();

INSERT INTO story_intelligence_jobs (source_item_id, source_content_hash)
SELECT id, content_hash
FROM source_items
ON CONFLICT (source_item_id) DO NOTHING;

ALTER TABLE story_intelligence_jobs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE story_intelligence_jobs IS
  'Lease-backed asynchronous boundary between source ingestion and reusable intelligence.';

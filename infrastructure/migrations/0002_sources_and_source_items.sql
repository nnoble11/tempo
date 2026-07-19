CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  homepage_url TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  adapter_kind TEXT NOT NULL,
  default_language TEXT NOT NULL,
  fetch_interval_minutes SMALLINT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  etag TEXT,
  last_modified TEXT,
  last_fetched_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sources_key_valid CHECK (
    key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  CONSTRAINT sources_adapter_kind_valid CHECK (
    adapter_kind IN ('rss', 'atom', 'json_api')
  ),
  CONSTRAINT sources_fetch_interval_range CHECK (
    fetch_interval_minutes BETWEEN 5 AND 1440
  ),
  CONSTRAINT sources_failure_count_nonnegative CHECK (
    consecutive_failures >= 0
  )
);

CREATE TABLE source_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  external_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL,
  language TEXT NOT NULL,
  excerpt TEXT,
  content_hash TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT source_items_source_external_unique UNIQUE (
    source_id,
    external_id
  ),
  CONSTRAINT source_items_hash_valid CHECK (
    content_hash ~ '^[a-f0-9]{64}$'
  )
);

CREATE INDEX source_items_source_published_index
  ON source_items (source_id, published_at DESC NULLS LAST, id DESC);

CREATE INDEX source_items_content_hash_index
  ON source_items (content_hash);

CREATE INDEX source_items_canonical_url_index
  ON source_items (canonical_url);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE sources IS
  'Registered first-party, licensed, or otherwise governed ingestion sources.';
COMMENT ON TABLE source_items IS
  'Normalized source records retaining canonical URLs and deterministic hashes.';

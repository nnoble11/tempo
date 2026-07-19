CREATE TABLE story_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deduplication_key TEXT NOT NULL UNIQUE,
  canonical_title TEXT NOT NULL,
  summary TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_updated_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT story_clusters_title_not_blank CHECK (
    LENGTH(BTRIM(canonical_title)) > 0
  ),
  CONSTRAINT story_clusters_status_valid CHECK (
    status IN ('active', 'superseded', 'archived')
  ),
  CONSTRAINT story_clusters_time_order_valid CHECK (
    last_updated_at >= first_seen_at
  )
);

CREATE TABLE story_cluster_items (
  cluster_id UUID NOT NULL REFERENCES story_clusters(id) ON DELETE CASCADE,
  source_item_id UUID NOT NULL REFERENCES source_items(id) ON DELETE RESTRICT,
  membership_score NUMERIC(5, 4) NOT NULL,
  is_primary BOOLEAN NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cluster_id, source_item_id),
  CONSTRAINT story_cluster_items_source_unique UNIQUE (source_item_id),
  CONSTRAINT story_cluster_items_membership_range CHECK (
    membership_score BETWEEN 0 AND 1
  )
);

CREATE UNIQUE INDEX story_cluster_items_one_primary_index
  ON story_cluster_items (cluster_id)
  WHERE is_primary;

CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES story_clusters(id) ON DELETE CASCADE,
  claim_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  is_contested BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT claims_cluster_key_unique UNIQUE (cluster_id, claim_key),
  CONSTRAINT claims_id_cluster_unique UNIQUE (id, cluster_id),
  CONSTRAINT claims_kind_valid CHECK (
    kind IN ('source_fact', 'reported_claim', 'inference')
  ),
  CONSTRAINT claims_text_not_blank CHECK (LENGTH(BTRIM(claim_text)) > 0),
  CONSTRAINT claims_confidence_range CHECK (confidence BETWEEN 0 AND 1)
);

CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL,
  cluster_id UUID NOT NULL,
  source_item_id UUID NOT NULL,
  support_type TEXT NOT NULL,
  supporting_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT citations_claim_source_unique UNIQUE (claim_id, source_item_id),
  CONSTRAINT citations_claim_cluster_foreign FOREIGN KEY (
    claim_id,
    cluster_id
  ) REFERENCES claims(id, cluster_id) ON DELETE CASCADE,
  CONSTRAINT citations_cluster_source_foreign FOREIGN KEY (
    cluster_id,
    source_item_id
  ) REFERENCES story_cluster_items(cluster_id, source_item_id) ON DELETE CASCADE,
  CONSTRAINT citations_support_type_valid CHECK (
    support_type IN ('direct', 'context', 'contradiction')
  )
);

CREATE TABLE candidate_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL UNIQUE REFERENCES story_clusters(id) ON DELETE CASCADE,
  candidate_key TEXT NOT NULL,
  headline TEXT NOT NULL,
  takeaway TEXT NOT NULL,
  what_changed TEXT NOT NULL,
  estimated_seconds SMALLINT NOT NULL,
  language TEXT NOT NULL,
  content_class TEXT NOT NULL DEFAULT 'editorial',
  status TEXT NOT NULL,
  global_importance_score NUMERIC(5, 4) NOT NULL,
  novelty_score NUMERIC(5, 4) NOT NULL,
  urgency_score NUMERIC(5, 4) NOT NULL,
  credibility_score NUMERIC(5, 4) NOT NULL,
  source_diversity_score NUMERIC(5, 4) NOT NULL,
  recency_score NUMERIC(5, 4) NOT NULL,
  clickbait_penalty NUMERIC(5, 4) NOT NULL,
  confidence_score NUMERIC(5, 4) NOT NULL,
  prompt_version TEXT,
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT candidate_updates_id_cluster_unique UNIQUE (id, cluster_id),
  CONSTRAINT candidate_updates_headline_not_blank CHECK (
    LENGTH(BTRIM(headline)) > 0
  ),
  CONSTRAINT candidate_updates_takeaway_not_blank CHECK (
    LENGTH(BTRIM(takeaway)) > 0
  ),
  CONSTRAINT candidate_updates_what_changed_not_blank CHECK (
    LENGTH(BTRIM(what_changed)) > 0
  ),
  CONSTRAINT candidate_updates_duration_range CHECK (
    estimated_seconds BETWEEN 15 AND 3600
  ),
  CONSTRAINT candidate_updates_content_class_editorial CHECK (
    content_class = 'editorial'
  ),
  CONSTRAINT candidate_updates_status_valid CHECK (
    status IN ('draft', 'ready', 'retired')
  ),
  CONSTRAINT candidate_updates_global_importance_range CHECK (
    global_importance_score BETWEEN 0 AND 1
  ),
  CONSTRAINT candidate_updates_novelty_range CHECK (
    novelty_score BETWEEN 0 AND 1
  ),
  CONSTRAINT candidate_updates_urgency_range CHECK (
    urgency_score BETWEEN 0 AND 1
  ),
  CONSTRAINT candidate_updates_credibility_range CHECK (
    credibility_score BETWEEN 0 AND 1
  ),
  CONSTRAINT candidate_updates_source_diversity_range CHECK (
    source_diversity_score BETWEEN 0 AND 1
  ),
  CONSTRAINT candidate_updates_recency_range CHECK (
    recency_score BETWEEN 0 AND 1
  ),
  CONSTRAINT candidate_updates_clickbait_penalty_range CHECK (
    clickbait_penalty BETWEEN 0 AND 1
  ),
  CONSTRAINT candidate_updates_confidence_range CHECK (
    confidence_score BETWEEN 0 AND 1
  )
);

CREATE TABLE candidate_claims (
  candidate_id UUID NOT NULL,
  cluster_id UUID NOT NULL,
  claim_id UUID NOT NULL,
  position SMALLINT NOT NULL,
  PRIMARY KEY (candidate_id, claim_id),
  CONSTRAINT candidate_claims_position_unique UNIQUE (candidate_id, position),
  CONSTRAINT candidate_claims_candidate_cluster_foreign FOREIGN KEY (
    candidate_id,
    cluster_id
  ) REFERENCES candidate_updates(id, cluster_id) ON DELETE CASCADE,
  CONSTRAINT candidate_claims_claim_cluster_foreign FOREIGN KEY (
    claim_id,
    cluster_id
  ) REFERENCES claims(id, cluster_id) ON DELETE CASCADE,
  CONSTRAINT candidate_claims_position_positive CHECK (position > 0)
);

CREATE INDEX story_clusters_updated_index
  ON story_clusters (last_updated_at DESC, id DESC);

CREATE INDEX claims_cluster_index
  ON claims (cluster_id, claim_key);

CREATE INDEX citations_source_item_index
  ON citations (source_item_id);

CREATE INDEX candidate_updates_ready_index
  ON candidate_updates (updated_at DESC, id DESC)
  WHERE status = 'ready';

ALTER TABLE story_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_cluster_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_claims ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE story_clusters IS
  'Reusable deduplicated story identities independent from any user.';
COMMENT ON TABLE claims IS
  'Typed factual, attributed, or inferred claims within a story cluster.';
COMMENT ON TABLE citations IS
  'Claim-to-source provenance constrained to source items in the same cluster.';
COMMENT ON TABLE candidate_updates IS
  'Reusable editorial candidates with only non-personalized baseline scores.';

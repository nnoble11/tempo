ALTER TABLE user_interests
  ADD CONSTRAINT user_interests_id_user_unique UNIQUE (id, user_id);

CREATE TABLE briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_minutes SMALLINT NOT NULL,
  actual_word_count INTEGER NOT NULL,
  estimated_seconds INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  overview TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT briefings_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT briefings_target_minutes_range CHECK (
    target_minutes BETWEEN 1 AND 60
  ),
  CONSTRAINT briefings_word_count_nonnegative CHECK (
    actual_word_count >= 0
  ),
  CONSTRAINT briefings_estimated_seconds_positive CHECK (
    estimated_seconds > 0
  ),
  CONSTRAINT briefings_duration_within_target CHECK (
    estimated_seconds <= target_minutes * 60
  ),
  CONSTRAINT briefings_status_valid CHECK (
    status IN ('ready', 'delivered', 'archived')
  ),
  CONSTRAINT briefings_overview_not_blank CHECK (
    LENGTH(BTRIM(overview)) > 0
  )
);

CREATE TABLE briefing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID NOT NULL,
  user_id UUID NOT NULL,
  candidate_update_id UUID NOT NULL,
  story_cluster_id UUID NOT NULL,
  user_interest_id UUID NOT NULL,
  position SMALLINT NOT NULL,
  headline TEXT NOT NULL,
  takeaway TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  what_changed TEXT NOT NULL,
  estimated_seconds SMALLINT NOT NULL,
  ranking_json JSONB NOT NULL,
  grounding_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT briefing_items_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT briefing_items_position_unique UNIQUE (briefing_id, position),
  CONSTRAINT briefing_items_cluster_unique UNIQUE (
    briefing_id,
    story_cluster_id
  ),
  CONSTRAINT briefing_items_briefing_user_foreign FOREIGN KEY (
    briefing_id,
    user_id
  ) REFERENCES briefings(id, user_id) ON DELETE CASCADE,
  CONSTRAINT briefing_items_candidate_cluster_foreign FOREIGN KEY (
    candidate_update_id,
    story_cluster_id
  ) REFERENCES candidate_updates(id, cluster_id) ON DELETE RESTRICT,
  CONSTRAINT briefing_items_interest_user_foreign FOREIGN KEY (
    user_interest_id,
    user_id
  ) REFERENCES user_interests(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT briefing_items_position_positive CHECK (position > 0),
  CONSTRAINT briefing_items_duration_range CHECK (
    estimated_seconds BETWEEN 15 AND 3600
  ),
  CONSTRAINT briefing_items_headline_not_blank CHECK (
    LENGTH(BTRIM(headline)) > 0
  ),
  CONSTRAINT briefing_items_takeaway_not_blank CHECK (
    LENGTH(BTRIM(takeaway)) > 0
  ),
  CONSTRAINT briefing_items_why_not_blank CHECK (
    LENGTH(BTRIM(why_it_matters)) > 0
  ),
  CONSTRAINT briefing_items_changed_not_blank CHECK (
    LENGTH(BTRIM(what_changed)) > 0
  ),
  CONSTRAINT briefing_items_ranking_object CHECK (
    JSONB_TYPEOF(ranking_json) = 'object'
  ),
  CONSTRAINT briefing_items_grounding_array CHECK (
    JSONB_TYPEOF(grounding_json) = 'array'
  )
);

CREATE TABLE briefing_generation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  briefing_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT briefing_generation_user_key_unique UNIQUE (
    user_id,
    idempotency_key
  ),
  CONSTRAINT briefing_generation_briefing_user_foreign FOREIGN KEY (
    briefing_id,
    user_id
  ) REFERENCES briefings(id, user_id) ON DELETE CASCADE,
  CONSTRAINT briefing_generation_hash_valid CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT briefing_generation_status_valid CHECK (
    status IN ('processing', 'completed')
  ),
  CONSTRAINT briefing_generation_completion_valid CHECK (
    (
      status = 'processing'
      AND briefing_id IS NULL
      AND completed_at IS NULL
    )
    OR (
      status = 'completed'
      AND briefing_id IS NOT NULL
      AND completed_at IS NOT NULL
    )
  )
);

CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  briefing_item_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  value_json JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT interactions_user_key_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT interactions_item_user_foreign FOREIGN KEY (
    briefing_item_id,
    user_id
  ) REFERENCES briefing_items(id, user_id) ON DELETE CASCADE,
  CONSTRAINT interactions_event_type_valid CHECK (
    event_type IN (
      'opened',
      'expanded',
      'saved',
      'source_clicked',
      'useful',
      'not_useful',
      'dismissed',
      'deferred'
    )
  ),
  CONSTRAINT interactions_value_object CHECK (
    JSONB_TYPEOF(value_json) = 'object'
  ),
  CONSTRAINT interactions_request_hash_valid CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
  )
);

CREATE INDEX briefings_user_today_index
  ON briefings (user_id, scheduled_for DESC, id DESC)
  WHERE status IN ('ready', 'delivered');

CREATE INDEX briefing_items_briefing_index
  ON briefing_items (briefing_id, position);

CREATE INDEX interactions_item_occurred_index
  ON interactions (briefing_item_id, occurred_at DESC, id DESC);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE briefings IS
  'Canonical per-user briefings stored before channel-specific rendering.';
COMMENT ON TABLE briefing_items IS
  'Personalized briefing items with immutable ranking and grounding snapshots.';
COMMENT ON TABLE briefing_generation_requests IS
  'User-scoped idempotency records preventing duplicate canonical briefings.';
COMMENT ON TABLE interactions IS
  'Explicit and behavioral feedback events scoped to a user-owned item.';

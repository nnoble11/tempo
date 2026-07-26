ALTER TABLE user_interests
  ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX user_interests_visible_index
  ON user_interests (user_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE briefing_item_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  briefing_item_id UUID NOT NULL,
  saved_at TIMESTAMPTZ,
  deferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT briefing_item_states_user_item_unique UNIQUE (
    user_id,
    briefing_item_id
  ),
  CONSTRAINT briefing_item_states_item_user_foreign FOREIGN KEY (
    briefing_item_id,
    user_id
  ) REFERENCES briefing_items(id, user_id) ON DELETE CASCADE,
  CONSTRAINT briefing_item_states_has_state CHECK (
    saved_at IS NOT NULL OR deferred_at IS NOT NULL
  )
);

CREATE INDEX briefing_item_states_saved_index
  ON briefing_item_states (user_id, saved_at DESC, id DESC)
  WHERE saved_at IS NOT NULL;

CREATE INDEX briefing_item_states_deferred_index
  ON briefing_item_states (user_id, deferred_at DESC, id DESC)
  WHERE deferred_at IS NOT NULL;

CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'device',
  display_name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'free_busy',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  timezone TEXT,
  range_starts_at TIMESTAMPTZ,
  range_ends_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_connections_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT calendar_connections_user_provider_unique UNIQUE (
    user_id,
    provider
  ),
  CONSTRAINT calendar_connections_provider_valid CHECK (
    provider = 'device'
  ),
  CONSTRAINT calendar_connections_scope_valid CHECK (
    scope = 'free_busy'
  ),
  CONSTRAINT calendar_connections_display_name_not_blank CHECK (
    LENGTH(BTRIM(display_name)) > 0
  ),
  CONSTRAINT calendar_connections_range_valid CHECK (
    (
      range_starts_at IS NULL
      AND range_ends_at IS NULL
      AND last_synced_at IS NULL
    )
    OR (
      range_starts_at IS NOT NULL
      AND range_ends_at IS NOT NULL
      AND range_starts_at < range_ends_at
      AND last_synced_at IS NOT NULL
      AND timezone IS NOT NULL
    )
  )
);

CREATE TABLE calendar_busy_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  user_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_busy_windows_connection_user_foreign FOREIGN KEY (
    connection_id,
    user_id
  ) REFERENCES calendar_connections(id, user_id) ON DELETE CASCADE,
  CONSTRAINT calendar_busy_windows_range_valid CHECK (starts_at < ends_at),
  CONSTRAINT calendar_busy_windows_unique UNIQUE (
    connection_id,
    starts_at,
    ends_at
  )
);

CREATE INDEX calendar_busy_windows_range_index
  ON calendar_busy_windows (connection_id, starts_at, ends_at);

ALTER TABLE briefing_item_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_busy_windows ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN user_interests.deleted_at IS
  'Soft deletion preserves historical briefing ownership while hiding the relationship.';
COMMENT ON TABLE briefing_item_states IS
  'Durable current Saved and Later state for user-owned canonical briefing items.';
COMMENT ON TABLE calendar_connections IS
  'Optional free/busy-only device calendar connection with no event descriptions.';
COMMENT ON TABLE calendar_busy_windows IS
  'Time-only busy intervals synchronized from an authorized calendar client.';

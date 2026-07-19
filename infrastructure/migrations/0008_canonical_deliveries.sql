CREATE TABLE delivery_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  destination_hash TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_endpoints_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT delivery_endpoints_destination_unique UNIQUE (
    user_id,
    channel,
    destination_hash
  ),
  CONSTRAINT delivery_endpoints_channel_valid CHECK (
    channel IN ('push', 'email', 'sms')
  ),
  CONSTRAINT delivery_endpoints_destination_not_blank CHECK (
    LENGTH(BTRIM(destination)) > 0
  ),
  CONSTRAINT delivery_endpoints_hash_valid CHECK (
    destination_hash ~ '^[a-f0-9]{64}$'
  )
);

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  briefing_id UUID NOT NULL,
  endpoint_id UUID,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  destination_hash TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ NOT NULL,
  next_attempt_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  worker_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  provider_message_id TEXT,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deliveries_user_key_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT deliveries_briefing_target_unique UNIQUE (
    briefing_id,
    channel,
    destination_hash
  ),
  CONSTRAINT deliveries_briefing_user_foreign FOREIGN KEY (
    briefing_id,
    user_id
  ) REFERENCES briefings(id, user_id) ON DELETE CASCADE,
  CONSTRAINT deliveries_endpoint_user_foreign FOREIGN KEY (
    endpoint_id,
    user_id
  ) REFERENCES delivery_endpoints(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT deliveries_channel_valid CHECK (
    channel IN ('push', 'email', 'sms')
  ),
  CONSTRAINT deliveries_status_valid CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')
  ),
  CONSTRAINT deliveries_destination_not_blank CHECK (
    LENGTH(BTRIM(destination)) > 0
  ),
  CONSTRAINT deliveries_destination_hash_valid CHECK (
    destination_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT deliveries_payload_object CHECK (
    JSONB_TYPEOF(payload_json) = 'object'
  ),
  CONSTRAINT deliveries_attempt_count_nonnegative CHECK (attempt_count >= 0),
  CONSTRAINT deliveries_request_hash_valid CHECK (
    request_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT deliveries_processing_lease_valid CHECK (
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
  CONSTRAINT deliveries_sent_state_valid CHECK (
    (
      status = 'sent'
      AND sent_at IS NOT NULL
      AND provider_message_id IS NOT NULL
    )
    OR status <> 'sent'
  ),
  CONSTRAINT deliveries_error_length CHECK (
    last_error IS NULL OR LENGTH(last_error) <= 2000
  )
);

CREATE INDEX delivery_endpoints_user_channel_index
  ON delivery_endpoints (user_id, channel, id)
  WHERE enabled = TRUE;

CREATE INDEX deliveries_claim_index
  ON deliveries (scheduled_for, next_attempt_at, lease_expires_at, id)
  WHERE status IN ('pending', 'processing', 'failed');

CREATE INDEX deliveries_user_history_index
  ON deliveries (user_id, created_at DESC, id DESC);

ALTER TABLE delivery_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE delivery_endpoints IS
  'User-controlled external destinations; values must never be written to logs.';
COMMENT ON TABLE deliveries IS
  'Auditable provider attempts rendered only from one canonical briefing.';

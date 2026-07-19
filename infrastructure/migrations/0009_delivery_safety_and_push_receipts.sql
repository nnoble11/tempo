ALTER TABLE user_preferences
  ADD COLUMN quiet_hours_start TIME,
  ADD COLUMN quiet_hours_end TIME;

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_quiet_hours_valid CHECK (
    (
      quiet_hours_start IS NULL
      AND quiet_hours_end IS NULL
    )
    OR (
      quiet_hours_start IS NOT NULL
      AND quiet_hours_end IS NOT NULL
      AND quiet_hours_start <> quiet_hours_end
    )
  );

ALTER TABLE delivery_endpoints
  ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN verified_at TIMESTAMPTZ,
  ADD COLUMN verification_code_hash TEXT,
  ADD COLUMN verification_expires_at TIMESTAMPTZ,
  ADD COLUMN verification_attempt_count INTEGER NOT NULL DEFAULT 0;

UPDATE delivery_endpoints
SET
  verification_status = 'verified',
  verified_at = created_at
WHERE channel = 'push';

ALTER TABLE delivery_endpoints
  ADD CONSTRAINT delivery_endpoints_verification_status_valid CHECK (
    verification_status IN ('pending', 'verified')
  ),
  ADD CONSTRAINT delivery_endpoints_verification_state_valid CHECK (
    (
      verification_status = 'verified'
      AND verified_at IS NOT NULL
      AND verification_code_hash IS NULL
      AND verification_expires_at IS NULL
    )
    OR (
      verification_status = 'pending'
      AND verified_at IS NULL
    )
  ),
  ADD CONSTRAINT delivery_endpoints_verification_hash_valid CHECK (
    verification_code_hash IS NULL
    OR verification_code_hash ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT delivery_endpoints_verification_attempts_valid CHECK (
    verification_attempt_count BETWEEN 0 AND 5
  );

ALTER TABLE deliveries
  ADD COLUMN receipt_status TEXT,
  ADD COLUMN receipt_checked_at TIMESTAMPTZ,
  ADD COLUMN receipt_error TEXT,
  ADD COLUMN receipt_worker_id TEXT,
  ADD COLUMN receipt_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN receipt_next_attempt_at TIMESTAMPTZ,
  ADD COLUMN receipt_attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE deliveries
  ADD CONSTRAINT deliveries_receipt_status_valid CHECK (
    receipt_status IS NULL
    OR receipt_status IN (
      'not_applicable',
      'pending',
      'processing',
      'accepted',
      'failed'
    )
  ),
  ADD CONSTRAINT deliveries_receipt_lease_valid CHECK (
    (
      receipt_status = 'processing'
      AND receipt_worker_id IS NOT NULL
      AND receipt_lease_expires_at IS NOT NULL
    )
    OR (
      receipt_status IS DISTINCT FROM 'processing'
      AND receipt_worker_id IS NULL
      AND receipt_lease_expires_at IS NULL
    )
  ),
  ADD CONSTRAINT deliveries_receipt_attempts_valid CHECK (
    receipt_attempt_count >= 0
  ),
  ADD CONSTRAINT deliveries_receipt_error_length CHECK (
    receipt_error IS NULL OR LENGTH(receipt_error) <= 2000
  );

CREATE INDEX deliveries_push_receipt_claim_index
  ON deliveries (
    receipt_next_attempt_at,
    receipt_lease_expires_at,
    id
  )
  WHERE
    channel = 'push'
    AND status = 'sent'
    AND receipt_status IN ('pending', 'processing', 'failed');

COMMENT ON COLUMN user_preferences.quiet_hours_start IS
  'User-local wall-clock start; both quiet-hour values are nullable together.';
COMMENT ON COLUMN delivery_endpoints.verification_status IS
  'Push is verified by device possession; email and SMS require destination proof.';
COMMENT ON COLUMN deliveries.receipt_status IS
  'Expo receipt reconciliation state, separate from initial push ticket acceptance.';

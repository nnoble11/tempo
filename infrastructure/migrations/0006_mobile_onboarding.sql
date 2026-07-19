ALTER TABLE users
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN onboarding_request_hash TEXT;

ALTER TABLE users
  ADD CONSTRAINT users_onboarding_state_valid CHECK (
    (
      onboarding_completed_at IS NULL
      AND onboarding_request_hash IS NULL
    )
    OR (
      onboarding_completed_at IS NOT NULL
      AND onboarding_request_hash ~ '^[a-f0-9]{64}$'
    )
  );

ALTER TABLE user_preferences
  ADD COLUMN delivery_channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'];

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_delivery_channels_valid CHECK (
    cardinality(delivery_channels) BETWEEN 1 AND 4
    AND delivery_channels <@ ARRAY['in_app', 'push', 'email', 'sms']
    AND delivery_channels @> ARRAY['in_app']
  );

COMMENT ON COLUMN users.onboarding_completed_at IS
  'Set only after preferences and at least one interest commit atomically.';
COMMENT ON COLUMN users.onboarding_request_hash IS
  'Makes onboarding completion safely retryable without duplicating interests.';
COMMENT ON COLUMN user_preferences.delivery_channels IS
  'Explicit user-selected channels; the canonical in-app briefing is required.';

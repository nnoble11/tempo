CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_not_blank CHECK (
    email IS NULL OR LENGTH(BTRIM(email)) > 0
  )
);

CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en-US',
  default_briefing_minutes SMALLINT NOT NULL DEFAULT 5,
  daily_briefing_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '08:00',
  calendar_suggestions_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  recommendations_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_preferences_briefing_minutes_range CHECK (
    default_briefing_minutes BETWEEN 1 AND 60
  )
);

CREATE TABLE interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT interests_type_valid CHECK (
    type IN ('topic', 'entity', 'instruction')
  ),
  CONSTRAINT interests_name_not_blank CHECK (LENGTH(BTRIM(name)) > 0)
);

CREATE TABLE user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  importance SMALLINT NOT NULL,
  expertise_level TEXT NOT NULL,
  desired_depth TEXT NOT NULL,
  alert_sensitivity SMALLINT NOT NULL,
  preferred_sources TEXT[] NOT NULL DEFAULT '{}',
  blocked_sources TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  excluded_keywords TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_interacted_at TIMESTAMPTZ,
  CONSTRAINT user_interests_user_interest_unique UNIQUE (user_id, interest_id),
  CONSTRAINT user_interests_importance_range CHECK (importance BETWEEN 1 AND 5),
  CONSTRAINT user_interests_expertise_valid CHECK (
    expertise_level IN ('beginner', 'intermediate', 'advanced', 'expert')
  ),
  CONSTRAINT user_interests_depth_valid CHECK (
    desired_depth IN ('brief', 'standard', 'deep')
  ),
  CONSTRAINT user_interests_alert_sensitivity_range CHECK (
    alert_sensitivity BETWEEN 0 AND 3
  )
);

CREATE INDEX user_interests_user_created_index
  ON user_interests (user_id, created_at DESC, id DESC);

CREATE INDEX user_interests_active_index
  ON user_interests (user_id, active)
  WHERE active = TRUE;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE users IS
  'Application users keyed by the verified external authentication subject.';
COMMENT ON TABLE user_preferences IS
  'Explicit, reversible briefing and recommendation preferences.';
COMMENT ON TABLE user_interests IS
  'User-owned interest settings. API queries must include user_id ownership.';

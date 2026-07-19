ALTER TABLE sources
  ADD COLUMN next_fetch_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN fetch_lease_owner TEXT,
  ADD COLUMN fetch_lease_until TIMESTAMPTZ,
  ADD COLUMN last_error TEXT,
  ADD CONSTRAINT sources_fetch_lease_pair_valid CHECK (
    (fetch_lease_owner IS NULL) = (fetch_lease_until IS NULL)
  );

CREATE INDEX sources_due_fetch_index
  ON sources (next_fetch_at, key)
  WHERE active;

COMMENT ON COLUMN sources.next_fetch_at IS
  'Earliest time a scheduler may claim this source for another fetch.';
COMMENT ON COLUMN sources.fetch_lease_owner IS
  'Worker invocation currently responsible for this source fetch.';
COMMENT ON COLUMN sources.fetch_lease_until IS
  'Lease expiry that makes an abandoned source fetch reclaimable.';
COMMENT ON COLUMN sources.last_error IS
  'Bounded operational error summary from the most recent failed fetch.';

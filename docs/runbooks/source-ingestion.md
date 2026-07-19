# Source Ingestion Runbook

Status: Foundation operations  
Last updated: 2026-07-17

## Purpose

The source-ingestion runner performs one bounded fetch cycle. It is safe for
scheduled invocations to overlap because due sources are protected by expiring
PostgreSQL leases.

## Before running

1. Configure `DATABASE_URL`.
2. Set `DATABASE_SSL=true` when the PostgreSQL provider requires TLS.
3. Apply current migrations with `pnpm db:migrate`.
4. Confirm outbound HTTPS access to the registered source domains.

Optional controls:

- `INGESTION_WORKER_ID`: explicit invocation identifier; generated when omitted
- `INGESTION_MAX_SOURCES`: maximum claimed sources, default `10`
- `INGESTION_LEASE_SECONDS`: abandoned-work lease, default `600`
- `INGESTION_HTTP_TIMEOUT_SECONDS`: per-request timeout, default `15`

The lease should exceed the worst-case duration of the configured HTTP attempts
plus item persistence.

## Run one cycle

```bash
pnpm ingest:sources
```

The command prints one structured JSON event. Exit code `0` means every claimed
source succeeded or was unchanged. Exit code `1` means at least one claimed
source failed or the cycle could not complete.

An invocation that claims zero sources is healthy; it means nothing is due.

## Scheduling

Invoke the command more frequently than the shortest source interval. Five
minutes is a reasonable initial scheduler cadence for the current 15-minute
minimum source interval. PostgreSQL `next_fetch_at` remains authoritative, so a
shorter scheduler cadence does not fetch sources early.

Do not configure overlapping invocations with the same worker ID. Generated
worker IDs are unique per process.

## Failure triage

Inspect the affected row in `sources`:

- `last_fetched_at`
- `last_success_at`
- `consecutive_failures`
- `next_fetch_at`
- `fetch_lease_owner`
- `fetch_lease_until`
- `last_error`

Expected behavior:

- transient request errors receive bounded immediate retries;
- permanent HTTP failures and invalid feed shapes skip immediate retries;
- repeated failed cycles increase scheduled backoff up to six hours;
- a successful cycle resets the failure count and clears `last_error`;
- a stale lease becomes reclaimable after `fetch_lease_until`.

Do not clear leases manually during a healthy invocation. If operational
recovery requires a state correction, use an audited script rather than an
ad-hoc production update.

## Verification

The normal repository test suite uses deterministic fixtures and temporary
PostgreSQL. Live source availability is intentionally not a unit-test
dependency. Add an operational live-feed smoke check when deployment monitoring
is introduced.

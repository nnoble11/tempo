# ADR-012: PostgreSQL-scheduled per-user briefing runs

Status: Accepted  
Date: 2026-07-17

## Context

Daily briefings are selected at a user's preferred local wall-clock time. The
workflow must be correct across timezones and daylight-saving changes,
observable when no candidate is selected, safe under concurrent schedulers, and
recoverable after a process exits.

The MVP does not yet justify a long-running orchestration service. A scheduler
invocation can also fail after canonical generation but before downstream
delivery records are created.

## Decision

An external scheduler invokes a one-shot generation runner. PostgreSQL decides
which users are due by converting the current instant into each user's IANA
timezone and comparing it with their local daily time.

The runner creates at most one `scheduled_briefing_runs` row per user and local
date, then claims eligible rows with `FOR UPDATE SKIP LOCKED` and an expiring
lease. Each row retains state, attempts, candidate/selection counts, retry time,
bounded error detail, and an optional canonical briefing.

Generation uses the run ID as its stable idempotency key. The canonical briefing
is attached to the run before downstream delivery scheduling. A reclaimed or
retried run first loads any existing briefing and resumes downstream work rather
than regenerating it. No matching grounded candidate is an observed `skipped`
outcome, not an empty or fabricated briefing.

## Alternatives considered

- One scheduler job per user
- A process-local timer in the API
- Generate all users at one fixed UTC time
- Add Celery, Temporal, or a message broker before the first workflow
- Mark a run complete before delivery records are scheduled
- Regenerate after every partial failure and deduplicate later

## Consequences

- The database is the durable workflow ledger and concurrency boundary.
- Local-date uniqueness handles repeated or skipped UTC offsets without
  producing two daily briefings.
- Operators can distinguish completed, skipped, retryable failed, and terminal
  failed runs.
- Expired leases allow crash recovery without a separate queue.
- Generation polling performs timezone calculation in PostgreSQL and will need
  measurement at larger user counts.
- Delivery scheduling failure delays run completion, but cannot duplicate the
  canonical briefing.

## Rollback or migration considerations

The one-shot runner can be disabled without changing canonical briefing reads. A
future queue or Temporal workflow should adopt the scheduled run ID and existing
state as its idempotency and migration boundary. Existing rows remain the audit
history; do not recompute past local dates from a user's current timezone.

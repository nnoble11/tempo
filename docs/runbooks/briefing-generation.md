# Scheduled Briefing Generation Runbook

## Purpose

`pnpm generate:briefings` performs one bounded cycle. It creates due
once-per-local-day run records, claims eligible work, assembles a personalized
plan from ready reusable stories, stores the canonical briefing, schedules
configured channel deliveries, records an outcome, and exits.

Run it only after migrations and the upstream story-intelligence workflow have
populated ready, grounded candidates.

## Required configuration

- `DATABASE_URL`
- `DATABASE_SSL`: `true` or `false`
- `BRIEFING_PUBLIC_BASE_URL`: the public origin whose `/briefings/:briefingId`
  route will open the canonical briefing

Optional controls:

- `GENERATION_WORKER_ID`: generated from host, process, and UUID when omitted
- `GENERATION_MAX_RUNS`: default 10, maximum 100
- `GENERATION_MAX_CANDIDATES`: default 100, maximum 200
- `GENERATION_LEASE_SECONDS`: default 600
- `GENERATION_MAX_ATTEMPTS`: default 3

Never place database credentials or delivery destinations in logs.

## Schedule

Invoke the command at least once per minute from one or more external scheduler
instances:

```bash
pnpm generate:briefings
```

PostgreSQL, not the scheduler, decides which users are due. Parallel invocations
are supported because claims use row locks and expiring leases. The command
emits one structured `briefing_generation_cycle_completed` event. A cycle with
any failed outcome exits nonzero; completed and intentionally skipped outcomes
do not.

## Expected outcomes

- `completed`: canonical briefing attached, delivery records scheduled
- `skipped`: no matching grounded candidate was available or fit the time budget
- `failed` with `next_attempt_at`: retryable within configured attempts
- `failed` with no `next_attempt_at`: terminal until an operator intervenes

Candidate and selected counts are retained on every run. Zero selected items
must never be converted into filler.

## Failure handling

1. Confirm migrations through `0010_story_intelligence_jobs.sql` are applied.
2. Inspect the run state and bounded `last_error`; do not log user interests or
   delivery destinations while investigating.
3. For database or deployment outages, restore service and let the persisted
   `next_attempt_at` become due.
4. For an abandoned `processing` run, do not edit it; another cycle reclaims it
   after `lease_expires_at`.
5. If `briefing_id` is already present, preserve it. The next claim resumes
   delivery scheduling and must not generate another briefing.
6. For a terminal configuration or data error, deploy the correction and use an
   audited forward script to set an intentional retry time. Never delete the
   canonical briefing or rewrite the run's local date.

## Safe smoke test

In a non-production database with an onboarded due user and a ready candidate:

```bash
pnpm generate:briefings
pnpm generate:briefings
```

The first invocation should complete or skip one run. The second must not create
another run for the same user and local date. Verify the canonical briefing's
duration, grounded citations, run counts, and scheduled deliveries before
enabling the recurring schedule.

# Story Intelligence Runbook

## Purpose

`pnpm process:intelligence` performs one bounded processing cycle. It claims
queued or retryable source-item jobs, produces validated story intelligence,
stores the aggregate, records the cluster on the job, and exits.

The initial deterministic processor is suitable for fixtures and end-to-end
product testing. It is not a substitute for the evaluated semantic/model
processor required before broad source coverage.

## Configuration

- `DATABASE_URL`
- `DATABASE_SSL`: `true` or `false`
- `INTELLIGENCE_WORKER_ID`: optional; generated when omitted
- `INTELLIGENCE_MAX_JOBS`: optional bounded claim size, default 25

## Schedule

Invoke after ingestion and at least once per minute:

```bash
pnpm process:intelligence
```

Parallel invocations are safe through row locks and expiring leases. A source
content-hash change resets its existing job to queued so the current normalized
version is processed. Completing an obsolete content hash cannot mark a newer
version processed.

## Failure handling

1. Inspect job state and bounded `last_error`; do not log full fetched text.
2. Restore database or processor availability and allow `next_attempt_at` to
   become due.
3. Let expired processing leases be reclaimed; do not clear a live worker.
4. Treat provenance validation failures as code/data incidents. Never insert
   unsupported claims manually.
5. When introducing a Python/model processor, keep the job ID, processed content
   hash, aggregate contract, prompt version, model version, and citation
   validation intact.

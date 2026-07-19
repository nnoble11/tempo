# ADR-009: One-shot ingestion with PostgreSQL leases

Status: Accepted  
Date: 2026-07-17

## Context

Tempo needs scheduled source ingestion that remains safe when invocations
overlap or a process crashes. The MVP already uses PostgreSQL, has three source
adapters, and does not yet have a workload that justifies Redis, Celery,
Temporal, or another queue.

A timer embedded in the user-facing API would couple deployment lifecycles and
could execute more than once when the API scales horizontally.

## Decision

Run source ingestion as a one-shot application invoked by an external scheduler.
Store `next_fetch_at` on each source and atomically claim due work with
PostgreSQL row locks, `SKIP LOCKED`, and an expiring worker lease.

Retry transient failures a bounded number of times within one invocation. After
a final failure, persist exponential scheduled backoff. Record success or
failure only when the completing worker still owns the lease.

## Alternatives considered

- Run an interval timer inside the product API
- Introduce Redis and a dedicated job queue immediately
- Use scheduler-level concurrency controls without database leases
- Allow overlapping runs and rely only on source-item upserts

## Consequences

- Multiple runner instances can safely overlap.
- A crashed invocation becomes reclaimable after lease expiry.
- Source schedule and failure state are inspectable in PostgreSQL.
- External deployment configuration determines invocation cadence.
- The runner processes a bounded batch and exits, simplifying health and cost
  accounting.
- PostgreSQL polling is sufficient at MVP scale but is not a general workflow
  engine.

## Rollback or migration considerations

The runner depends on a repository interface rather than lease SQL directly. A
future queue or workflow engine can claim sources through a replacement
implementation while preserving source keys, normalized payloads, retry
semantics, and idempotent item writes. Lease columns may remain for transition
observability until all workers have migrated.

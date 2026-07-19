# ADR-015: PostgreSQL story-intelligence jobs with a replaceable processor

Status: Accepted  
Date: 2026-07-18

## Context

Source ingestion must not block on clustering and claim extraction. The MVP
already uses PostgreSQL leases for bounded work and does not yet need the
operational cost of Redis, Celery, or Temporal. A grounded test environment also
needs a deterministic processor before model evaluation is production-ready.

## Decision

A trigger creates or resets one `story_intelligence_jobs` row per inserted or
content-changed source item. One-shot workers claim jobs with row locks,
expiring leases, bounded retries, and processed-content-hash checks.

The initial TypeScript processor derives a stable title cluster and one direct
excerpt claim. It implements a provider-neutral interface and persists explicit
processor/model versions. A future Python semantic/model implementation will
consume the same source-item job and save the same validated aggregate.

## Alternatives considered

- Perform intelligence synchronously inside ingestion
- Add Redis and Celery before the first workload
- Wait for model-based processing before enabling an end-to-end path
- Let each personalized generation call cluster source items independently

## Consequences

- Ingestion and reusable intelligence retry independently.
- Duplicate worker invocations do not create duplicate jobs.
- The test path has conservative, direct provenance rather than unsupported
  synthetic claims.
- PostgreSQL is sufficient for initial throughput but is not assumed to be the
  permanent workflow engine.
- Semantic quality remains deliberately limited until evaluated processing is
  introduced.

## Rollback or migration considerations

Moving to Celery, Temporal, or another queue should enqueue the source-item/job
identity and preserve processed content hashes. Existing PostgreSQL job rows
remain an audit/migration source. Switching processor languages does not change
the story aggregate, citations, or canonical briefing contract.

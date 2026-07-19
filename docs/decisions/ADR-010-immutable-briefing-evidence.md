# ADR-010: Immutable briefing evidence snapshots

Status: Accepted  
Date: 2026-07-17

## Context

Reusable story clusters, candidates, claims, and citations change as new
coverage arrives. A historical briefing must still explain exactly what ranking
and evidence supported the item when it was generated. Rejoining a briefing to
the current reusable aggregate would silently rewrite history and could make a
previous citation appear unsupported or missing.

Generation and feedback are also retryable operations. Duplicate briefings or
interactions would distort delivery and personalization.

## Decision

Each canonical briefing item references its reusable candidate, cluster, and
user interest while also storing immutable snapshots of:

- the transparent per-user ranking result;
- the selected typed claims;
- every claim-level citation and support relationship shown at generation.

Canonical generation and interaction writes use user-scoped idempotency keys.
Each key is bound to a deterministic request hash. A matching retry returns the
original result; a different request using the same key fails as a conflict.

## Alternatives considered

- Reconstruct historical evidence by joining only to current reusable records
- Copy only citation URLs without claim mappings or support types
- Rely on globally unique keys without a request hash
- Allow retries to insert duplicate artifacts and deduplicate later

## Consequences

- Historical briefings remain auditable after story intelligence changes.
- Delivery renderers can consume a stable canonical artifact.
- Storage grows with every selected evidence snapshot.
- Reusable foreign keys still provide lineage, but renderers do not depend on
  mutable reusable text for historical output.
- Clients and workers must generate stable idempotency keys and treat conflicts
  as programming or workflow errors.

## Rollback or migration considerations

Snapshot shapes may be versioned or normalized later, but existing snapshots
must remain readable. A future archival policy may compress old evidence but
cannot discard the claim-to-source relationship while the briefing is retained.
Idempotency records can be expired only after the associated operation can no
longer be retried.

# Story Intelligence

Status: Asynchronous deterministic processor implemented  
Last updated: 2026-07-18

## Purpose

Story intelligence turns normalized source items into a reusable, grounded
editorial candidate before any user-specific ranking occurs.

```text
source item ──► cluster membership
                     │
                     ▼
                  citation ──► typed claim
                                      │
                                      ▼
                              reusable candidate
```

The final candidate is synthesis, not a replacement for provenance. Its ordered
claims retain the exact source items and canonical URLs that support them.

## Aggregate write contract

A story write contains:

1. one cluster with at least one source item and exactly one primary item;
2. one or more typed claims;
3. at least one same-cluster citation for every claim;
4. one reusable editorial candidate;
5. an ordered subset of the story claims selected for that candidate.

Source facts and reported claims require a direct citation. Inferences are
stored as `inference` and may use contextual evidence. A contradiction cannot be
the only citation attached to a claim.

Invalid provenance is rejected before a transaction starts and again by
composite database foreign keys.

## Transaction and idempotency

`PostgresStoryRepository.saveStoryIntelligence` treats the input as the current
story snapshot:

- the cluster is upserted by its stable deduplication key;
- claims are upserted by stable keys within the cluster;
- citations and candidate-claim ordering are replaced;
- memberships and claims absent from the new snapshot are removed;
- unchanged cluster, claim, and candidate identifiers remain stable;
- the entire operation commits or rolls back together.

Source items cannot silently join multiple clusters. A future merge or split
workflow must make that movement explicit.

## Reusable candidate scores

| Stored globally               | Added per user                     |
| ----------------------------- | ---------------------------------- |
| Importance, novelty, urgency  | Personal relevance                 |
| Credibility, source diversity | Interest strength                  |
| Recency, confidence           | Behavioral affinity and timing fit |
| Clickbait penalty             | Redundancy and fatigue             |

Commercial-content pressure is also evaluated outside this editorial aggregate.
Product recommendations remain a separate content class.

## Current boundary

Every inserted or content-changed source item queues one
`story_intelligence_jobs` row through a database trigger.
`pnpm process:intelligence` leases due jobs with `FOR UPDATE SKIP LOCKED`,
bounded attempts, expiring leases, and persisted backoff.

The initial processor is deliberately deterministic:

- normalized titles form stable cluster keys;
- the first complete excerpt sentence becomes a directly supported claim;
- the source item becomes the citation and primary membership;
- conservative baseline scores and explicit processor versions are persisted.

This creates a fully grounded end-to-end test path without presenting a model
guess as fact. `StoryIntelligenceProcessor` is provider-neutral, so a future
Python semantic/model processor can replace the implementation without changing
job ownership, aggregate validation, or canonical briefing provenance.

The canonical briefing layer now consumes this aggregate without mutating it. It
selects only candidate-linked claims, snapshots their citations alongside the
per-user ranking, and persists the result before any delivery rendering. The
next story-intelligence milestone is an evaluated semantic/model processor with
merge/split handling, conflicting-claim detection, and citation factuality
evaluations.

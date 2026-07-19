# ADR-003: Reusable global intelligence layer

Status: Accepted  
Date: 2026-07-17

## Context

Fetching, cleaning, embedding, extracting, clustering, and summarizing the same
story independently for every user would be slow, costly, and inconsistent.
User-specific relevance and explanation still require a personalized layer.

## Decision

Process sources into reusable story clusters, claims, citations, baseline
summaries, and global features. Apply user-specific ranking, time allocation,
ordering, depth, and explanation only after reusable processing.

## Alternatives considered

- Fully personalized processing from raw sources
- Fully global briefings with only topic filters
- Per-interest rather than per-story caches

## Consequences

- Reusable artifacts require stable identifiers and versioned cache keys.
- Personalized code must not mutate shared candidate artifacts.
- Prompt, model, language, depth, and freshness dimensions participate in
  relevant cache keys.
- Cost and quality can be measured separately for reusable and personalized
  work.

## Rollback or migration considerations

Processing stages communicate through versioned contracts. An individual
extraction, clustering, or model provider can be replaced and its artifacts
recomputed without changing the personalized briefing contract.

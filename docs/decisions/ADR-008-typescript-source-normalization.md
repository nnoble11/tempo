# ADR-008: TypeScript source normalization boundary

Status: Accepted  
Date: 2026-07-17

## Context

The first ingestion slice needs to fetch public feeds, normalize inconsistent
RSS, RDF, and Atom shapes, validate source items, and persist them through the
existing PostgreSQL data layer. The repository already shares Zod contracts
across its TypeScript packages, while no Python ML workload or queue exists yet.

Introducing a Python worker solely for XML transport would create a second
contract implementation and deployment boundary before claim extraction,
semantic clustering, or other Python-oriented work exists.

## Decision

Implement credential-free feed transport and deterministic source-item
normalization in a focused TypeScript package. Keep the adapter contract
independent from the HTTP client and database repository so fixture tests can
exercise parsing without network access.

Use Python later for claim extraction, semantic clustering, ranking experiments,
and other ML workloads. Cross-language job payloads must use versioned schemas
that preserve source identifiers, canonical URLs, content hashes, and
provenance.

## Alternatives considered

- Introduce the Python worker and queue with the first RSS adapter
- Put source-specific parsing directly in the API service
- Use a single generic parser with no per-source registration
- Delay ingestion until the full ML pipeline exists

## Consequences

- The first source pipeline reuses the existing TypeScript contracts, PostgreSQL
  repositories, and test tooling.
- Source adapters remain isolated from user-facing routes.
- The future Python worker consumes normalized records instead of owning basic
  feed transport by default.
- A source with non-feed parsing needs its own governed adapter and contract
  tests.
- Queue infrastructure remains absent until an asynchronous workflow requires
  it.

## Rollback or migration considerations

The `SourceAdapter`, `NormalizedSourceItem`, and repository boundaries do not
depend on the concrete TypeScript parser. A future Python ingestion service can
emit the same versioned payload and write through an internal API or equivalent
repository boundary. Existing source keys and database identifiers must remain
stable during such a migration.

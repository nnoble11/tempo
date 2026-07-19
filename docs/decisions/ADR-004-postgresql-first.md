# ADR-004: PostgreSQL first

Status: Accepted  
Date: 2026-07-17

## Context

The MVP needs transactional storage, structured filters, full-text search,
relationships, and initial vector retrieval. Introducing separate databases for
each concern would increase operational complexity before scale requirements are
known.

## Decision

Use PostgreSQL for transactional data, structured filtering, full-text search,
and initial vector retrieval with `pgvector`. Use Supabase as the initial
managed PostgreSQL and authentication provider while keeping domain logic and
migrations portable to standard PostgreSQL.

## Alternatives considered

- PostgreSQL plus a dedicated search engine from the start
- Document database
- Managed vector database
- Multiple purpose-specific databases

## Consequences

- All schema changes use migrations.
- Search limitations are measured before adding another engine.
- Supabase-specific behavior stays behind infrastructure boundaries.
- Row Level Security may provide defense in depth but does not replace
  application authorization.

## Rollback or migration considerations

Standard SQL migrations and provider-neutral domain repositories preserve a path
to another managed PostgreSQL host. A dedicated search or vector system can be
introduced later through an ADR and a rebuildable indexing pipeline.

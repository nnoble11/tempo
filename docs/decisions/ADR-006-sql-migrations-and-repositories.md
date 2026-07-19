# ADR-006: SQL migrations and explicit repositories

Status: Accepted  
Date: 2026-07-17

## Context

Tempo needs a portable PostgreSQL data layer with auditable migrations,
parameterized queries, and clear ownership boundaries. The initial schema and
query surface are small, and the project does not yet benefit from an ORM's
entity lifecycle or code-generation model.

## Decision

Use ordered SQL migration files and `node-postgres` for the TypeScript
application layer. Keep SQL inside focused repository classes and return
domain-shaped contracts rather than leaking driver rows into routes.

Migrations are recorded in a `tempo_migrations` table and applied under a
PostgreSQL advisory lock. Integration tests run against real PostgreSQL.

## Alternatives considered

- A TypeScript ORM with generated migrations
- A query builder
- Supabase client queries throughout the application
- Schema synchronization without migration files

## Consequences

- SQL remains explicit and reviewable.
- Repository methods must map rows and maintain ownership predicates.
- Every schema change requires an ordered migration.
- Supabase remains a hosting and authentication choice rather than a domain
  dependency.
- More sophisticated query composition may justify a later query-builder ADR.

## Rollback or migration considerations

Repository interfaces isolate callers from `node-postgres`. A future query
builder or ORM can implement the same interfaces incrementally. Database
rollbacks use forward corrective migrations once a migration has reached a
shared environment.

# Architecture Decision Records

Architecture Decision Records capture consequential choices before or alongside
implementation.

Each ADR includes status, date, context, decision, alternatives, consequences,
and migration or rollback considerations. A later decision must explicitly
supersede an accepted ADR rather than silently reversing it.

## Accepted decisions

- [ADR-001: Mobile-first with a web companion](./ADR-001-mobile-first.md)
- [ADR-002: Canonical briefing model](./ADR-002-canonical-briefing.md)
- [ADR-003: Reusable global intelligence layer](./ADR-003-reusable-intelligence.md)
- [ADR-004: PostgreSQL first](./ADR-004-postgresql-first.md)
- [ADR-005: Explicit and behavioral personalization](./ADR-005-personalization.md)
- [ADR-006: SQL migrations and explicit repositories](./ADR-006-sql-migrations-and-repositories.md)
- [ADR-007: Supabase-compatible JWT authentication boundary](./ADR-007-supabase-jwt-boundary.md)
- [ADR-008: TypeScript source normalization boundary](./ADR-008-typescript-source-normalization.md)
- [ADR-009: One-shot ingestion with PostgreSQL leases](./ADR-009-postgresql-ingestion-leases.md)
- [ADR-010: Immutable briefing evidence snapshots](./ADR-010-immutable-briefing-evidence.md)
- [ADR-011: Secure mobile authentication and atomic onboarding](./ADR-011-secure-mobile-auth-and-atomic-onboarding.md)
- [ADR-012: PostgreSQL-scheduled per-user briefing runs](./ADR-012-postgresql-scheduled-briefing-runs.md)
- [ADR-013: Canonical delivery snapshots and provider adapters](./ADR-013-canonical-delivery-snapshots-and-provider-adapters.md)
- [ADR-014: Verified destinations and local quiet hours](./ADR-014-verified-destinations-and-quiet-hours.md)
- [ADR-015: PostgreSQL story-intelligence jobs with a replaceable processor](./ADR-015-postgresql-story-intelligence-jobs.md)
- [ADR-016: Deterministic isolated test environment](./ADR-016-deterministic-test-environment.md)

## Template

New ADRs should contain:

1. Title
2. Status
3. Date
4. Context
5. Decision
6. Alternatives considered
7. Consequences
8. Rollback or migration considerations

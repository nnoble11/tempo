# ADR-016: Deterministic isolated test environment

Status: Accepted  
Date: 2026-07-18

## Context

Manual testing needs a known account and grounded briefing without depending on
live source timing. Reset tooling must not normalize destructive database-wide
operations, and client testing needs the option to create a real Supabase Auth
identity.

## Decision

A dedicated test-environment application owns bootstrap, smoke, and guarded
reset commands. Bootstrap uses fixed fixture identities and source keys, applies
migrations, optionally creates the Supabase Auth user through the server-only
admin API, processes story intelligence, and generates one briefing.

Reset requires the exact `tempo-test-only` confirmation value and removes only
the fixed user/source aggregate in foreign-key-safe order. Automated integration
tests exercise first bootstrap, repeated bootstrap, grounded state, and reset
against a temporary real PostgreSQL server.

## Alternatives considered

- Depend on live first-party feeds for manual tests
- Ship SQL fixture files that bypass domain repositories
- Truncate all tables during reset
- Use a production Supabase project for testers

## Consequences

- The test fixture is repeatable and carries real citation relationships.
- A database-only mode validates the pipeline without external credentials.
- Interactive client login still requires a dedicated Supabase test project.
- The service-role key is a test server secret and must never reach clients.

## Rollback or migration considerations

Fixture data can evolve through stable source/user keys while keeping bootstrap
idempotent. A future ephemeral-environment platform can invoke the same
commands. Reset must remain narrow and guarded even if deployment orchestration
changes.

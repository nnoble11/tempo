# ADR-007: Supabase-compatible JWT authentication boundary

Status: Accepted  
Date: 2026-07-17

## Context

The MVP intends to use Supabase Auth, while the product API must authorize every
user-owned resource and preserve a migration path to another identity provider.
Trusting unverified token claims or coupling routes directly to a Supabase SDK
would weaken both security and portability.

## Decision

Verify bearer tokens in the API with an `AccessTokenVerifier` interface. The
production implementation validates Supabase-compatible JWTs against the
project's remote JWKS, issuer, and audience. Routes use the verified `sub` as
the only user identifier for ownership queries.

The API maintains a local application user keyed by the external subject. It
never accepts a user ID from request bodies or query parameters for user-scoped
operations.

## Alternatives considered

- Supabase SDK calls inside each route
- Shared symmetric JWT secrets
- Session lookups on every request
- Unverified JWT decoding

## Consequences

- Key rotation is handled through JWKS.
- Authentication can be replaced in tests without bypassing authorization.
- Repository queries must include the verified user ID.
- Missing, malformed, expired, incorrectly issued, or incorrectly scoped tokens
  return a stable unauthorized response.

## Rollback or migration considerations

A new identity provider can implement `AccessTokenVerifier` while preserving
application user IDs or migrating them explicitly. Changing issuer, audience, or
subject mapping requires an ADR and an account migration plan.

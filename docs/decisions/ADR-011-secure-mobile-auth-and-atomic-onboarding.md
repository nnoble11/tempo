# ADR-011: Secure mobile authentication and atomic onboarding

Status: Accepted  
Date: 2026-07-17

## Context

The mobile Today experience previously depended on a session that no in-product
flow could create. Account creation also needs to establish preferences and at
least one interest without exposing a half-onboarded account to scheduled
generation. Retried mobile mutations must not duplicate interests.

Native refresh tokens are sensitive session material. Public Expo configuration
may identify the Supabase project, but it cannot contain bearer tokens or
service-role credentials.

## Decision

The Expo client uses Supabase's JavaScript client behind a local `AuthProvider`.
It persists native sessions through Expo SecureStore, uses browser local storage
on web, refreshes while the native app is active, and obtains the bearer token
for each Tempo API request from the current Supabase session.

Expo Router protects signed-in and onboarding-complete route groups. A single
authenticated onboarding endpoint transaction:

- synchronizes the application user;
- replaces explicit preferences and delivery-channel choices;
- creates the initial interests;
- stores an onboarding completion timestamp and deterministic request hash.

A matching retry returns the same profile and interest state. A different
payload after onboarding completion returns an idempotency conflict.

## Alternatives considered

- Accept a development bearer token through a public Expo environment variable
- Store access and refresh tokens in AsyncStorage
- Let the client call preferences and interest endpoints independently
- Make onboarding completion a client-only flag
- Allow direct anonymous Supabase table writes under broad Row Level Security

## Consequences

- The application has a real account-creation-to-Today path.
- Native session material receives operating-system-backed storage.
- There is no observable state where onboarding is complete but its preferences
  or initial interests are missing.
- Password and confirmation behavior follows the configured Supabase project.
- The client remains coupled to Supabase's session SDK at the authentication
  edge, while API authorization and domain repositories remain provider-neutral.
- A completed user intentionally cannot rerun the first-run onboarding contract
  with different input; subsequent changes use ordinary settings endpoints.

## Rollback or migration considerations

Another OpenID Connect provider can replace the mobile session adapter and API
token verifier while retaining application user UUIDs and account contracts.
Session storage keys should be removed through the existing provider's local
sign-out before removing the SDK. If onboarding becomes resumable, introduce
explicit versioned step state in a forward migration instead of weakening the
current atomic completion invariant.

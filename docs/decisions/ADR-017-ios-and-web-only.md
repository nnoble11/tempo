# ADR-017: Focus client development on iOS and web

Status: Accepted

Date: 2026-07-25

Supersedes: [ADR-001](./ADR-001-mobile-first.md)

## Context

Tempo needs a calm, high-quality native daily briefing and a capable responsive
companion. Maintaining more than one native platform divides product,
accessibility, release, and end-to-end testing effort before the core habit has
been validated.

## Decision

Tempo will support an iOS Expo/React Native application and a Next.js web
companion. Native build profiles, continuous integration, documentation, QA
evidence, and platform-specific notification behavior will target iOS only.
Shared contracts, domain logic, API routes, canonical briefing data, delivery
providers, and responsive web behavior remain client-neutral.

## Alternatives considered

- Continue supporting multiple native platforms.
- Pause native development and ship only the responsive web companion.
- Replace Expo with a fully native Swift application immediately.

## Consequences

- Native design, accessibility, notifications, and release testing can focus on
  one platform.
- The responsive web companion remains available outside the native client.
- Cross-platform React Native code may remain when it also supports web or
  improves portability, but no second native build or release path is
  maintained.
- CI exports only the iOS bundle.
- EAS build profiles and credentials are maintained only for iOS.

## Rollback or migration considerations

The API, database, contracts, and canonical briefing model remain
platform-neutral. A future native client can be introduced as a new decision
without migrating server data, but it must establish its own release,
notification, accessibility, and end-to-end QA gates.

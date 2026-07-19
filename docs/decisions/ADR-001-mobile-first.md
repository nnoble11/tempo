# ADR-001: Mobile-first with a web companion

Status: Accepted  
Date: 2026-07-17

## Context

Tempo depends on timely, context-aware delivery and a repeatable daily habit.
Mobile devices are best positioned for notifications, calendar permissions, and
short reading sessions. A larger web surface remains useful for setup,
management, search, and deeper reading.

## Decision

Use Expo with React Native for iOS and Android. Use Next.js for the responsive
web companion. Share TypeScript contracts and design tokens where practical,
without forcing platform-specific user-interface code into a single abstraction.

## Alternatives considered

- Responsive web application only
- Separate native iOS and Android applications
- Desktop-first web application

## Consequences

- Mobile owns the Today experience and daily briefing habit.
- Web owns configuration-heavy and long-form workflows.
- Push notifications and mobile permissions are first-class product concerns.
- Shared packages must not assume browser-only or React Native-only APIs.

## Rollback or migration considerations

The API and domain packages remain client-neutral. Either client can be replaced
independently as long as it continues consuming the versioned contracts and
canonical briefing model.

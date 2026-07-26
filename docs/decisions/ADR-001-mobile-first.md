# ADR-001: Mobile-first with a web companion

Status: Superseded by [ADR-017](./ADR-017-ios-and-web-only.md)

Date: 2026-07-17

## Context

Tempo depends on timely, context-aware delivery and a repeatable daily habit.
Mobile devices are best positioned for notifications, calendar permissions, and
short reading sessions. A larger web surface remains useful for setup,
management, search, and deeper reading.

## Decision

Use a shared native client strategy with a responsive web companion. This
decision's original platform scope is superseded by ADR-017; its mobile-first,
canonical-briefing, and client-neutral API principles remain valid.

## Alternatives considered

- Responsive web application only
- Separate native applications
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

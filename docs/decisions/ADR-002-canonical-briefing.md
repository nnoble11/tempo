# ADR-002: Canonical briefing model

Status: Accepted  
Date: 2026-07-17

## Context

Tempo delivers through in-app views, push notifications, email, SMS links, and
eventually other channels. Independently generated channel content would cause
factual drift, inconsistent ordering, duplicate delivery, and weak auditing.

## Decision

Store one canonical briefing and its structured briefing items. Every channel
renders a variant from that stored model and records a delivery that references
the canonical briefing.

## Alternatives considered

- Generate a separate briefing per channel
- Store only final rendered HTML or text
- Reconstruct channel output from source clusters during delivery

## Consequences

- Briefing generation is separated from delivery.
- Channel renderers cannot add unsupported factual claims.
- Delivery behavior is auditable and idempotent.
- Channel-specific truncation and formatting must preserve citation links and
  item identity.

## Rollback or migration considerations

New channels can be added as renderers without changing stored editorial
content. Schema evolution must version canonical briefing data and preserve
historical renderability where required.

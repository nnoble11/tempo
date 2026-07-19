# ADR-005: Explicit and behavioral personalization

Status: Accepted  
Date: 2026-07-17

## Context

Tempo needs enough context to rank information personally without requiring
invasive access to email, browsing history, private calendar content, or other
unrelated accounts.

## Decision

The MVP personalizes from user-entered interests and preferences, in-product
reading behavior, and optional free/busy calendar availability. Every learned
preference must remain understandable, reversible, and controllable by the user.

## Alternatives considered

- Email or browser-history ingestion in the MVP
- Only explicit preferences with no behavioral adaptation
- Fully opaque behavioral recommendations

## Consequences

- Interactions are recorded as explicit event types.
- Non-clicks are not automatically interpreted as negative feedback.
- Calendar descriptions are excluded unless a later use case explicitly requires
  and authorizes them.
- Users can inspect, mute, reset, export, and delete personalization data.

## Rollback or migration considerations

Additional context sources require separate permission flows, provider
boundaries, privacy review, and an ADR. Removing a context source must not
prevent the product from functioning with explicit preferences alone.

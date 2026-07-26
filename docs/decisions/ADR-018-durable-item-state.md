# ADR-018: Separate durable item state from behavioral interactions

Status: Accepted

Date: 2026-07-25

## Context

Tempo already records append-only `saved` and `deferred` interactions for
personalization. An event log cannot answer the user-facing question “is this
item currently Saved or in Later?” without interpreting an expanding sequence of
events, and it cannot represent unsave or removal cleanly under the existing
interaction contract.

Saved and Later must persist across sessions and across iOS and web. Historical
briefing evidence must remain immutable.

## Decision

Store current user intent in a user-owned `briefing_item_states` relation with
nullable `saved_at` and `deferred_at` timestamps. One row may represent either
or both states. Remove the row when neither state remains.

Keep `saved` and `deferred` interactions as append-only behavioral signals when
the user enables a state. Current-state writes and behavioral events have
different responsibilities; a failed behavioral event does not undo a successful
explicit state change.

Saved and Later collections read canonical briefing items and their immutable
grounding snapshots. They do not copy or regenerate editorial content.

## Alternatives considered

- Derive current state from the interaction event log.
- Store Saved and Later as independent copied-item tables.
- Keep the state only in local client storage.

## Consequences

- Save, unsave, defer, and remove are durable and consistent across clients.
- One item can be both Saved and in Later.
- Ownership is enforced by composite item/user foreign keys and repository
  predicates.
- Canonical briefing deletion cascades state; ordinary history retention keeps
  it available.
- The interaction log remains useful for personalization without becoming a
  mutable state store.

## Rollback or migration considerations

The new table can be removed without changing canonical briefing or interaction
records. Before rollback, clients must stop calling the state endpoints or fall
back to non-durable presentation.

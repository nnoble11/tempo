# ADR-019: Synchronize time-only device calendar availability

Status: Accepted

Date: 2026-07-25

## Context

Calendar-aware briefing suggestions are valuable only if users can understand
and trust the privacy boundary. A server-side Google or Microsoft OAuth
integration would add provider tokens, webhook lifecycle, and more calendar
metadata before the closed beta needs them.

The iOS app already has the authenticated user context and can ask for optional
read permission at the moment the user chooses to connect.

## Decision

The iOS app reads the next 48 hours of device events and uploads only clipped
busy start/end timestamps plus the synchronization range and IANA timezone. It
does not upload calendar names, event identifiers, titles, descriptions,
locations, attendees, or notes.

PostgreSQL stores one user-owned `device` connection with `free_busy` scope and
merged time-only windows. The API calculates the first qualifying open window
and suggests a briefing duration no longer than the user's default.

Disconnecting disables calendar suggestions and deletes all synchronized busy
windows. Tempo never edits the device calendar.

## Alternatives considered

- Launch with Google Calendar OAuth and server-side free/busy queries.
- Upload complete events and redact them later.
- Calculate suggestions only on device with no cross-client visibility.

## Consequences

- Permission and refresh are explicit iOS actions.
- Web can display the derived suggestion and provide deletion controls without
  receiving private event content.
- Availability becomes stale until the iOS app refreshes it; the UI says when
  the connection was last synchronized.
- Provider-backed continuous synchronization remains a future adapter behind the
  same time-only availability boundary.

## Rollback or migration considerations

Disconnecting every connection removes synchronized windows without affecting
briefings or preferences beyond disabling suggestions. A future provider adapter
can add a new provider value and token store while retaining the free/busy
contract.

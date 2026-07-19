# ADR-014: Verified destinations and local quiet hours

Status: Accepted  
Date: 2026-07-18

## Context

Email and SMS destinations are user-entered sensitive identifiers. Scheduling a
message before proving control creates privacy and abuse risk. External messages
must also respect a user's local quiet hours across time zones and
daylight-saving transitions.

## Decision

Push tokens are verified by successful authenticated registration. An email is
verified immediately only when it exactly matches the verified identity email.
All other email and SMS endpoints require a random six-digit code sent through a
provider-neutral sender. Tempo stores only an HMAC-derived code hash, expiry,
and bounded attempt count.

Delivery scheduling reads only enabled, verified endpoints. It evaluates the
nullable quiet-hour pair in the user's IANA timezone and advances the external
delivery instant to the next allowed minute. The canonical in-app briefing is
not delayed.

## Alternatives considered

- Treat every authenticated endpoint submission as verified
- Send a first briefing as the verification message
- Store verification codes in plaintext
- Evaluate quiet hours in server UTC
- Suppress the canonical briefing during quiet hours

## Consequences

- Pending endpoints remain visible and manageable but never receive briefings.
- Delivery-provider credentials are required to verify non-identity email and
  SMS destinations in a shared environment.
- Minute-by-minute timezone resolution is simple and DST-safe at MVP volume.
- Verification codes and destinations must not appear in logs or analytics.

## Rollback or migration considerations

Verification senders can be replaced without changing endpoint state. A future
magic-link or carrier verification flow can write the same verified status.
Quiet-hour scheduling can later use a more optimized timezone algorithm while
retaining the same local-time contract and tests.

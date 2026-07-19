# ADR-013: Canonical delivery snapshots and provider adapters

Status: Accepted  
Date: 2026-07-17

## Context

Push, email, and SMS must be delivery variants of one canonical briefing, not
independent editorial products. Channel work needs user-controlled destinations,
retries, provider result tracking, and protection against two workers sending
the same due row concurrently.

Provider APIs differ in payload shapes and idempotency support. Some dispatches
can be accepted remotely before a worker records local success.

## Decision

Configured channels and enabled endpoints are resolved only after a canonical
briefing is stored. Tempo renders channel-validated push, email, and SMS
payloads from that briefing and persists the immutable payload before dispatch.

Each delivery is unique per briefing, channel, and destination hash. Its
user-scoped idempotency key is bound to a deterministic request hash. A one-shot
delivery runner claims due records with `FOR UPDATE SKIP LOCKED`, an expiring
lease, attempt count, and bounded exponential backoff.

Provider adapters implement one interface and return a provider message
identifier. The initial adapters are Expo Push, Resend email, and Twilio SMS.
Provider configuration remains in the application edge; domain scheduling and
the delivery repository do not depend on a vendor SDK.

## Alternatives considered

- Regenerate or summarize separately in each channel worker
- Render only at provider-send time from mutable story data
- Store only provider message IDs without the sent payload
- Call provider APIs directly from the generation transaction
- Use one vendor-specific delivery table per channel
- Introduce a broker before delivery volume requires it

## Consequences

- Every external message is auditable against one canonical briefing.
- Retrying rendering cannot change the already-scheduled payload.
- Concurrent workers do not intentionally claim the same healthy delivery.
- Resend receives the stable local idempotency key.
- Expo and Twilio dispatch currently have an at-least-once ambiguity if the
  process dies after remote acceptance but before local success is committed.
- Push receipt reconciliation, invalid-endpoint disablement, quiet hours, and
  phone/email verification are supplied by the follow-on ADR-014 implementation;
  ambiguous provider acceptance still requires operational monitoring.

## Rollback or migration considerations

A provider can be replaced by registering a new adapter for the same channel;
stored payload and delivery records remain valid. Payload schema changes should
be versioned or remain backward readable because retries may process older
records. Introducing a queue should enqueue the delivery ID, not copy or
regenerate its payload. Historical delivery rows must remain linked to the
canonical briefing.

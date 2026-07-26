# API

Status: Authenticated closed-beta account, library, calendar, and delivery API
Last updated: 2026-07-25

The Fastify API uses versioned REST routes under `/v1`. Boundary payloads are
validated with shared Zod contracts.

## Authentication

User-owned endpoints require:

```text
Authorization: Bearer <access-token>
```

The production verifier checks the Supabase JWKS, issuer, audience, expiration,
and subject. The verified subject is the only source of user identity.

Authentication failures use:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication is required."
  }
}
```

## Public foundation endpoints

### `GET /health`

Returns API process health.

### `POST /v1/briefings/plan`

Validates reusable candidates, calculates transparent ranking results, and
returns a deterministic duration-bounded plan. It does not persist or generate a
briefing.

## User endpoints

### `GET /v1/users/me`

Creates or synchronizes the local application user from the verified identity
and returns the user with default or saved preferences.

### `GET /v1/preferences`

Returns the authenticated user's briefing preferences.

### `PUT /v1/preferences`

Replaces explicit preferences. Required fields:

- `timezone`
- `locale`
- `defaultBriefingMinutes`
- `dailyBriefingTime`
- `quietHoursStart` and `quietHoursEnd`: a nullable pair of distinct local
  `HH:MM` values
- `deliveryChannels`: unique selection containing mandatory `in_app` and any of
  `push`, `email`, or `sms`
- `calendarSuggestionsEnabled`
- `recommendationsEnabled`

### `POST /v1/onboarding`

Atomically completes first-run setup. The body contains:

- `preferences`: the full preferences payload above;
- `interests`: one through 25 complete topic, entity, or instruction inputs with
  unique case-insensitive names.

The operation stores an input hash. A matching retry returns the same profile
and interest collection without creating duplicates. A different retry after
completion returns an idempotency conflict.

### `GET /v1/interests`

Returns a cursor-paginated interest page. Query parameters:

- `limit`: 1 through 100, default 20
- `cursor`: opaque user-interest UUID returned as `nextCursor`
- `active`: optional `true` or `false` filter

### `POST /v1/interests`

Creates a topic, entity, or natural-language instruction and its user-specific
settings.

### `PATCH /v1/interests/:userInterestId`

Updates the name, description, user-specific importance, depth, expertise, alert
sensitivity, source controls, keywords, or active state. Setting `active` to
false mutes the interest; setting it to true reactivates it. Ownership is scoped
by the verified token subject.

### `DELETE /v1/interests/:userInterestId`

Soft-deletes an owned topic, entity, or natural-language rule from future
selection while retaining the relationship required by historical briefing
evidence. Missing and cross-user IDs both return `NOT_FOUND`.

### `GET /v1/briefings/today`

Returns the authenticated user's latest `ready` or `delivered` canonical
briefing whose scheduled time is not in the future:

```json
{
  "briefing": null
}
```

`briefing` is `null` when no briefing is available. A present briefing includes
ordered items, transparent ranking snapshots, grounded claims, and citations.

### `GET /v1/briefings`

Returns cursor-paginated canonical briefing history in reverse scheduled order.
Each summary includes status, overview, target and estimated duration, and item
count. `limit` accepts 1 through 100 and `cursor` is the prior page's
`nextCursor`.

### `GET /v1/briefings/:briefingId`

Returns one canonical briefing owned by the authenticated user. Missing and
cross-user IDs both return `NOT_FOUND`.

### `POST /v1/briefings/:briefingId/items/:briefingItemId/interactions`

Records feedback or reading behavior against a user-owned item. The body
contains:

- `eventType`: `opened`, `expanded`, `saved`, `source_clicked`, `useful`,
  `not_useful`, `dismissed`, or `deferred`;
- `value`: optional structured metadata;
- `occurredAt`: optional ISO timestamp;
- `idempotencyKey`: required client-generated key.

The first successful write returns `201`. Retrying the same user/key/payload
returns the original interaction. Reusing the key for different input returns an
idempotency conflict.

### `PUT /v1/briefing-items/:briefingItemId/state`

Sets durable current state with one or both optional booleans:

- `saved`
- `deferred`

At least one field is required. A present state returns `200`; removing both
states returns `204`. The item must belong to the authenticated user.

### `GET /v1/briefings/:briefingId/item-states`

Returns current Saved/Later state for all owned items in one briefing.

### `GET /v1/library/saved`

### `GET /v1/library/later`

Return cursor-paginated canonical items in the selected collection. Each result
includes its current state, briefing summary, and immutable canonical item.

### `PUT /v1/calendar/connections/device`

Enables one owned `device` connection with fixed `free_busy` scope. This route
does not accept provider tokens or event data.

### `POST /v1/calendar/connections/:connectionId/availability`

Replaces the synchronized availability range. The strict body accepts only:

- IANA `timezone`;
- `rangeStartsAt` and `rangeEndsAt`, no more than seven days apart;
- at most 500 `busyWindows`, each containing only `startsAt` and `endsAt` inside
  the synchronized range.

Unknown private-event fields are rejected.

### `GET /v1/calendar/availability`

Returns the owned connection, synchronized range, and first qualifying
free-window suggestion. `minimumMinutes` accepts 2 through 60; optional `now`
supports deterministic testing.

### `DELETE /v1/calendar/connections/:connectionId`

Disables the owned connection, deletes all synchronized busy windows, clears
range metadata, and disables calendar suggestions. Missing and cross-user IDs
both return `NOT_FOUND`.

### `GET /v1/delivery-endpoints`

Returns the authenticated user's push, email, and SMS endpoints, including
disabled endpoints.

### `PUT /v1/delivery-endpoints`

Creates or updates one endpoint selected by its channel and normalized
destination:

- `push`: an Expo push token;
- `email`: a valid email address;
- `sms`: an E.164 phone number;
- `enabled`: optional, defaults to `true`.

Push tokens are verified when created. The authenticated identity email is
verified when it exactly matches the destination. Other email addresses and SMS
numbers begin in `pending` state and are excluded from delivery.

### `POST /v1/delivery-endpoints/:endpointId/verification`

Generates a six-digit, ten-minute code, stores only its keyed hash, and sends it
through the configured email or SMS provider. Returns `202` with the endpoint
and expiry. Push or already verified destinations return `NOT_FOUND`.

### `POST /v1/delivery-endpoints/:endpointId/verification/confirm`

Accepts `{ "code": "123456" }`. A matching unexpired owned code marks the
endpoint verified; expired, wrong, or attempt-exhausted codes return
`INVALID_VERIFICATION_CODE`.

### `DELETE /v1/delivery-endpoints/:endpointId`

Disables an owned endpoint. Missing and cross-user IDs both return `NOT_FOUND`;
the historical delivery relation is retained.

### `GET /v1/deliveries`

Returns the latest owned channel-delivery records. `limit` accepts 1 through 100
and defaults to 20. Records include the immutable rendered payload, delivery
state, attempt count, provider message ID, bounded failure metadata, and Expo
receipt status/check/error fields.

## Error shape

Errors have a stable envelope:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request did not match the contract.",
    "details": []
  }
}
```

Current codes are `INVALID_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`,
`INVALID_VERIFICATION_CODE`, `IDEMPOTENCY_CONFLICT`, and `INTERNAL_ERROR`.

# Data Model

Status: Closed-beta account, briefing, library, calendar, and delivery
persistence Last updated: 2026-07-25

## Current scope

The current migrations store application identities, explicit briefing
preferences, user-owned interests, registered sources, normalized source items,
reusable story intelligence, canonical per-user briefing history, scheduled
generation runs, durable Saved/Later state, time-only calendar availability,
delivery endpoints, and delivery attempts. Supabase Auth remains the identity
provider; the application `users` table is keyed by the verified JWT subject.

```text
users
  │ 1
  ├──────── 1 user_preferences
  ├──────── * scheduled_briefing_runs ─── 0..1 briefings
  ├──────── * delivery_endpoints
  ├──────── * deliveries * ────────────── 1 briefings
  ├──────── 0..1 calendar_connections ─── * calendar_busy_windows
  │
  ├──────── * user_interests * ──────── 1 interests
  │                  │
  │                  └──────── * briefing_items * ──────── 1 briefings
  │                                      │                      │
  │                                      ├──── * interactions   └──── * generation_requests
  │                                      └──── 0..1 briefing_item_states
  │
  └────────────────────────────────────────────────────────  * briefings

sources
  │ 1
  └──────── * source_items
                  │
                  └──── 1 story_cluster_items * ──── 1 story_clusters
                                                        │
                                                        ├──── * claims
                                                        │       └──── * citations
                                                        │
                                                        └──── 1 candidate_updates
                                                                └──── * candidate_claims
```

## Tables

### `users`

- `id`: UUID matching the verified external authentication subject
- `email`: nullable synchronized identity metadata
- `onboarding_completed_at`
- `onboarding_request_hash`: SHA-256 input binding for safe retry
- `created_at`
- `updated_at`

Requests cannot provide a user ID for scoped operations. The API derives it from
the verified bearer token.

### `user_preferences`

- `user_id`: primary key and foreign key to `users`
- `timezone`: IANA time-zone identifier
- `locale`
- `default_briefing_minutes`: constrained from 1 through 60
- `daily_briefing_time`: local wall-clock time
- `quiet_hours_start` and `quiet_hours_end`: nullable local wall-clock pair
- `delivery_channels`: explicit unique selection from `in_app`, `push`, `email`,
  and `sms`; `in_app` is mandatory
- `calendar_suggestions_enabled`
- `recommendations_enabled`
- `created_at`
- `updated_at`

Recommendations default off. Calendar suggestions also default off.

Onboarding stores its request hash and completion timestamp in the same
transaction that replaces preferences and creates the initial interests. A
matching retry returns the completed account state; a different payload under
the completed onboarding operation is an idempotency conflict.

### `interests`

- `id`
- `type`: `topic`, `entity`, or `instruction`
- `name`
- `description`
- `created_at`

This separates an interest's identity from the user's relationship to it. The
foundation creates one interest record for each user creation; canonical
interest reuse can be added later without changing the relationship model.

### `user_interests`

- `id`
- `user_id`
- `interest_id`
- `importance`: 1 through 5
- `expertise_level`
- `desired_depth`
- `alert_sensitivity`: 0 through 3
- preferred and blocked sources
- included and excluded keywords
- `active`
- `deleted_at`: nullable soft-deletion marker
- `created_at`
- `updated_at`
- `last_interacted_at`

All reads and mutations include `user_id` in their ownership predicate. An
unauthorized update returns the same not-found response as a missing resource.
Deletion deactivates and hides the relationship but retains it so historical
briefing-item foreign keys and evidence remain valid.

### `sources`

- `id`
- stable adapter `key`
- display `name`
- homepage and feed URLs
- adapter kind and default language
- fetch interval and active state
- `etag` and `last_modified` conditional-request metadata
- last fetch and success timestamps
- consecutive failure count
- explicit next-fetch time
- current lease owner and lease expiry
- bounded last-error summary
- `created_at`
- `updated_at`

The source key is the durable join point between an adapter registration and its
database record. A registration upsert updates configuration without
reactivating a deliberately disabled source. Due-source claims use
`FOR UPDATE SKIP LOCKED`; expired leases make abandoned work reclaimable without
allowing two healthy workers to process the same source.

### `source_items`

- `id`
- `source_id`
- source-provided `external_id`
- normalized `canonical_url`
- title, author, publication time, and discovery time
- language and excerpt
- deterministic SHA-256 `content_hash`
- source-specific `metadata_json`
- `created_at`
- `updated_at`

The `(source_id, external_id)` pair is unique. Re-fetching unchanged content
does not issue an update; changed normalized content updates the item while
retaining its earliest discovery time.

### `story_intelligence_jobs`

One job exists per source item. Inserts and content-hash changes queue or reset
the row through a database trigger. Jobs retain queued, processing, completed,
or failed state; attempt count; worker and lease; next-attempt time; bounded
error; resulting cluster; processed content hash; and completion timestamps.
Claims use `FOR UPDATE SKIP LOCKED`, so parallel one-shot workers remain
coordinated without an additional broker.

### `story_clusters`

- `id`
- stable `deduplication_key`
- canonical title and optional baseline summary
- first-seen and last-updated timestamps
- `active`, `superseded`, or `archived` status
- `created_at`
- `updated_at`

Clusters are reusable global identities. Their source membership is stored in
`story_cluster_items` with a normalized membership score and exactly one primary
source enforced by the write contract.

Each source item belongs to at most one cluster. Moving or merging a source item
therefore requires an explicit clustering operation rather than silently
duplicating it across stories.

### `claims` and `citations`

Claims belong to one cluster and have a stable key, confidence, contested flag,
and explicit kind:

- `source_fact`
- `reported_claim`
- `inference`

Every claim write requires at least one supporting citation. Facts and reported
claims require direct support; inference may use contextual support but remains
explicitly labeled.

Each citation maps a claim to a normalized source item and records whether the
source directly supports, provides context for, or contradicts the claim. A
composite foreign key guarantees the cited source item belongs to the same
cluster as the claim.

### `candidate_updates` and `candidate_claims`

One reusable editorial candidate is stored per cluster. It contains:

- headline, takeaway, and what changed;
- conservative estimated reading seconds;
- language and lifecycle status;
- global importance, novelty, urgency, credibility, source diversity, recency,
  clickbait-penalty, and confidence components;
- prompt and model versions;
- an ordered set of grounded claims.

Candidate storage deliberately excludes personal relevance, interest strength,
behavioral affinity, timing fit, fatigue, and other per-user state. Those values
are added only when a reusable candidate is ranked for a specific user.

Repository writes replace the aggregate membership and mappings transactionally
while preserving stable cluster, claim, and candidate identifiers for unchanged
keys.

### `briefings` and `briefing_items`

A briefing is the canonical, user-owned editorial artifact stored before any
channel-specific rendering. It contains:

- the target minutes and duration-bounded estimated seconds;
- actual word count, schedule time, and generation time;
- lifecycle status;
- the “why today matters” overview;
- prompt and model versions;
- an ordered, non-repeating set of briefing items.

Each item references exactly one reusable candidate, story cluster, and
user-owned interest. It stores the personalized takeaway fields plus two
immutable JSON snapshots:

- `ranking_json`: the transparent ranking components and final score selected
  for this user;
- `grounding_json`: the exact typed claims and claim-level citations supporting
  the delivered item.

Composite foreign keys prevent a candidate from being paired with the wrong
cluster and prevent a user interest from being paired with the wrong user.
Updating reusable story intelligence later does not rewrite either snapshot.

### `briefing_generation_requests`

Generation requests bind a user-scoped idempotency key to a SHA-256 request hash
and, on completion, exactly one briefing. A retry with the same key and hash
returns the existing briefing. Reusing the key with different input is a
conflict.

The request and briefing are committed in one transaction. The schema supports
`processing` and `completed` states without admitting a partially completed
record.

### `interactions`

Interactions record explicit and behavioral events against a user-owned briefing
item:

- opened or expanded;
- saved;
- source clicked;
- useful or not useful;
- dismissed or deferred.

Each interaction has structured value metadata, occurrence time, and a
user-scoped idempotency key bound to a request hash. The item/user composite
foreign key prevents cross-user feedback.

### `briefing_item_states`

One optional row stores the authenticated user's current intent for a canonical
briefing item:

- `user_id` and `briefing_item_id`;
- nullable `saved_at`;
- nullable `deferred_at`;
- `created_at` and `updated_at`.

At least one state timestamp must be present, and `(user_id, briefing_item_id)`
is unique. A composite foreign key proves the item belongs to the same user.
Removing both states deletes the row. This mutable current state is
intentionally separate from append-only behavioral interactions; enabling Save
or Later still records a personalization event.

Saved and Later queries join back to the canonical item and briefing. They do
not copy summaries or grounding, so later reads retain exactly the immutable
ranking, claims, and citations originally shown.

### `scheduled_briefing_runs`

One run exists per `(user_id, local_date)`. The due-run query converts the
current instant into each user's IANA timezone and compares it with their local
`daily_briefing_time`; this retains the intended wall-clock schedule across
daylight-saving changes.

Each row retains:

- the local date and resolved UTC `scheduled_for` time;
- `queued`, `processing`, `completed`, `skipped`, or `failed` state;
- attempt, candidate, and selected-item counts;
- optional canonical `briefing_id`;
- worker ID and lease expiry while processing;
- next-attempt time and bounded error text;
- start and completion timestamps.

The canonical briefing is attached before delivery scheduling. Processing and
failed rows may therefore retain a briefing during crash recovery. A reclaimed
run loads that briefing and resumes downstream scheduling rather than
regenerating.

### `delivery_endpoints`

Delivery endpoints are user-owned push, email, or SMS destinations. They retain
the destination, a SHA-256 destination hash, enabled state, verification status
and time, a temporary verification-code hash/expiry/attempt count, and
timestamps. `(user_id, channel, destination_hash)` is unique. DELETE through the
API disables an endpoint so already-rendered historical deliveries retain their
lineage.

Destinations are sensitive operational data and must not be included in
structured logs. Push tokens and the exact authenticated identity email can be
trusted immediately; all other email and SMS endpoints remain ineligible for
delivery until verification succeeds.

### `calendar_connections` and `calendar_busy_windows`

The closed-beta calendar boundary stores one optional `device` connection per
user with:

- a non-sensitive display name and fixed `free_busy` scope;
- active state, IANA timezone, synchronized range, and last-sync timestamp;
- merged busy intervals containing only `starts_at` and `ends_at`.

The schema deliberately has no event title, description, location, attendee,
calendar-name, or event-identifier columns. Every busy window has a composite
connection/user foreign key and a positive range. Disconnecting deletes all
windows, clears synchronization metadata, and disables calendar suggestions.

### `deliveries`

Each delivery references one canonical briefing and optionally the endpoint that
selected its destination. A delivery stores:

- `push`, `email`, or `sms` channel;
- destination and destination hash;
- the immutable, channel-validated rendered payload;
- `pending`, `processing`, `sent`, `failed`, or `cancelled` state;
- schedule, next-attempt, lease, attempt-count, and bounded error metadata;
- provider message ID and sent time;
- Expo receipt status, receipt lease, check time, next-attempt time, attempt
  count, and bounded receipt error;
- a user-scoped idempotency key and deterministic request hash.

The `(briefing_id, channel, destination_hash)` tuple is unique. A matching retry
returns the existing record, while reuse of an idempotency key with different
input fails. Provider dispatch reads the stored payload; it never rereads source
items or generates editorial prose.

## Migrations

Ordered migrations live under `infrastructure/migrations/`. The migration
runner:

1. records applied filenames in `tempo_migrations`;
2. acquires a PostgreSQL advisory lock;
3. applies each pending file in its own transaction;
4. safely performs no work when rerun.

Run migrations with:

```bash
pnpm db:migrate
```

Shared environments use forward corrective migrations rather than editing an
already-applied migration.

## Row-level security

User-facing tables have PostgreSQL Row Level Security enabled with no public
policies. The product API uses a trusted database role and performs explicit
ownership checks in repositories. Supabase client access must remain blocked
until narrowly scoped policies are deliberately introduced and tested.

## Next schema milestone

Story-intelligence evaluation artifacts may be added separately from production
claims so prompt/model comparisons cannot rewrite canonical briefing evidence.
Provider-backed calendar tokens, if introduced, require a separate encrypted
credential store and must continue producing the same time-only availability
boundary.

# Tempo Architecture

Status: End-to-end testable MVP foundation implemented  
Last updated: 2026-07-18

## Architectural goals

Tempo's architecture serves a mobile-first, finite daily briefing. It must
preserve citations, make ranking explainable, fit a real reading-time budget,
and keep reusable story intelligence separate from user-specific decisions.

The MVP favors explicit boundaries and PostgreSQL-backed workflows over
additional infrastructure.

## System boundaries

```text
Sources
  │
  ▼
Fetch and normalize
  │
  ▼
Deduplicate and cluster ──► claims and citations
  │
  ▼
Reusable candidate updates
  │
  ├──► transparent ranking features
  │
  ▼
Personalized selection and time allocation
  │
  ▼
Canonical briefing and briefing items
  │
  ├──► in-app/mobile
  ├──► web
  ├──► push
  ├──► email
  └──► SMS link
```

The canonical briefing is stored before channel rendering. Channels must not
independently regenerate factual content.

## Implemented product slice

The executable foundation now starts at authenticated account creation and
credential-free first-party feeds and ends with a canonical briefing consumed in
the mobile app or rendered for configured delivery channels:

1. Sign in or create an account through Supabase Auth and persist the native
   session in device secure storage.
2. Atomically commit preferences, delivery choices, and initial interests during
   onboarding.
3. Fetch and normalize official RSS, RDF, or Atom entries while preserving
   canonical URLs, source identity, and deterministic content hashes.
4. Claim due sources with expiring PostgreSQL leases, bounded retry, and
   persisted backoff.
5. Queue changed normalized items for a lease-backed intelligence worker, which
   persists reusable story candidates, grounded claims, and citations
   independently of any user.
6. Create at most one observable scheduled generation run per user and local
   date from their IANA timezone and preferred wall-clock time.
7. Match ready candidates to active interests, apply explicit source and keyword
   controls, and retain transparent personalized score components.
8. Select grounded candidates within a strict target duration and with
   cross-interest diversity.
9. Persist the canonical briefing and immutable ranking/evidence snapshots under
   a user-scoped idempotency record.
10. Attach the canonical briefing to its scheduled run before performing
    downstream work so a retry resumes instead of regenerating.
11. Render and persist distinct push, email, and SMS payloads from only the
    canonical briefing.
12. Claim due deliveries with expiring leases and send through provider-neutral
    Expo Push, Resend, or Twilio adapters with bounded retry.
13. Expose account, onboarding, interests, Today, briefing detail, feedback,
    delivery endpoints, and delivery history through authenticated `/v1`
    endpoints.
14. Render protected sign-in, onboarding, destination management, push
    registration, and a finite, expandable, citation-linked Today experience in
    Expo.
15. Deep-link notification opens to canonical mobile briefing detail, reconcile
    Expo receipts, and disable invalid device tokens.
16. Render responsive authenticated web sign-in, onboarding, Today, and
    canonical `/briefings/:id` routes from the same API contracts.
17. Bootstrap, smoke-check, and guarded-reset a deterministic test fixture
    through dedicated operational commands.

PostgreSQL persistence now covers application users, onboarding state, explicit
preferences, and user-owned interests; registered sources and normalized source
items; reusable story clusters, claims, citations, and candidate updates;
canonical briefings, briefing items, generation requests, and interactions;
scheduled generation runs; delivery endpoints; and immutable delivery records.

## Intended application boundaries

### Mobile

Expo with React Native owns the daily habit, push-notification entry points,
briefing consumption, item expansion, feedback, and reading-position state.

The initial client implements protected sign-in, account creation, onboarding,
physical-device push registration, Today consumption, notification deep links,
and verified destination/quiet-hour settings with Expo Router and TanStack
Query. Supabase manages session refresh; native session material is stored
through Expo SecureStore. API calls resolve the current access token from that
session, never from a public development token.

### Web

Next.js currently owns responsive sign-in, onboarding, Today, and canonical
briefing reading. It shares the Supabase bearer-token/API boundary with mobile
while keeping browser sessions in browser storage. Interest/source management,
billing, history, and search remain follow-on companion features.

### Product API

A TypeScript Fastify service owns authenticated user-facing operations and
orchestrates domain services. Network inputs are validated with shared Zod
contracts. The API exposes REST endpoints under `/v1`. It applies a
deployment-configured exact-origin CORS allowlist.

Fastify is selected for the initial small-team implementation. Moving to a more
opinionated framework remains possible because domain logic is kept outside the
transport layer.

### Ingestion runner and ML workers

The initial TypeScript source-adapter package owns credential-free feed
transport and deterministic normalization into shared Zod contracts. This keeps
source identity, canonicalization, hashing, and PostgreSQL writes in one typed
boundary.

A one-shot TypeScript ingestion application is invoked by an external scheduler.
Each invocation registers its known adapters, atomically leases due sources,
processes claimed sources concurrently, and exits with structured results.

Two additional one-shot applications claim scheduled per-user generation runs
and due delivery records. The generation runner stores the canonical briefing
before scheduling channel payloads. The delivery runner selects a provider by
channel and records the provider message identifier or bounded error. Scheduling
remains a deployment concern rather than a long-running timer inside the product
API.

Changed source items now enqueue idempotent intelligence jobs in PostgreSQL. A
one-shot worker leases each job, applies the initial deterministic clustering
and directly grounded first-claim processor, saves the aggregate, and records
bounded retry state. The processor interface is provider-neutral.

A Python implementation will replace or extend that processor when semantic
clustering, model-based claim extraction, and ranking experiments justify the
additional runtime. It will consume the same job identity and aggregate
contract, so queue state and provenance storage do not move.

### Data

PostgreSQL will initially serve transactional data, full-text search, structured
filtering, and vector retrieval. Supabase is the intended managed PostgreSQL and
authentication provider, while domain logic remains portable to standard
PostgreSQL.

Ordered SQL migrations and explicit `node-postgres` repositories form the
initial TypeScript data layer. Repositories always scope user-owned operations
with the verified authentication subject.

### Authentication

The API validates bearer tokens through a provider-neutral verifier. The
production verifier uses the Supabase project's JWKS, issuer, and audience.
Verified subjects are mapped to local application users; request payloads cannot
select a different user identity.

## Core data separation

Reusable data:

- source items;
- content hashes and cleaned content;
- entities and topics;
- story clusters;
- extracted claims and citation mappings;
- baseline importance, novelty, and credibility features.

Personalized data:

- user interests and preferences;
- ranking component values derived for a user;
- timing fit and fatigue;
- selected briefing items and ordering;
- personalized explanations;
- interactions and delivery state.

Commercial recommendations are a separate content class and cannot influence
editorial story ranking.

## Reliability rules

- Background jobs use idempotency keys.
- Retries must be safe and observable.
- Source fetches use expiring leases and explicit next-attempt timestamps.
- User-owned resources are authorized at every boundary.
- Fetched content is untrusted input.
- Private calendar descriptions are not logged or sent to models.
- Prompt and model versions are stored with generated artifacts.
- Every final factual claim maps to a supporting source.
- Generated items snapshot the exact claims, citations, and ranking shown.
- Generation and interaction idempotency keys are scoped per user and bound to a
  request hash.
- Onboarding completion, scheduled generation, and delivery scheduling also bind
  stable keys to deterministic input.
- Scheduled generation and delivery workers use expiring leases, explicit
  attempt counts, next-attempt times, and bounded error text.
- A generation retry reuses an already attached canonical briefing before
  attempting delivery scheduling again.
- A channel delivery always references a canonical stored briefing.
- Rendered delivery payloads are stored before provider dispatch and cannot
  independently synthesize factual content.
- Only verified destinations are eligible for external delivery.
- Quiet hours are evaluated in the user's local timezone before a delivery is
  scheduled.
- Expo tickets enter a separate receipt lease; a terminal invalid-token receipt
  disables only the matching endpoint.

## Testing strategy

The implementation grows through these test layers:

1. Unit tests for ranking, normalization, and duration allocation.
2. Contract tests for source adapters and network schemas.
3. Integration tests for PostgreSQL and job boundaries.
4. Prompt evaluations for grounding, citation support, relevance, and length.
5. End-to-end tests for onboarding and briefing consumption.
6. Delivery tests for time zones, daylight saving time, and quiet hours.

No feature is considered complete until its critical path is exercised at the
appropriate layer.

## Next architecture milestones

1. Connect a dedicated shared Supabase test project and deploy the API, runners,
   scheduler, and web companion with managed secrets.
2. Add browser/mobile end-to-end automation for sign-in, onboarding, Today,
   destination verification, and notification navigation.
3. Add calendar availability through a provider-neutral read-only boundary.
4. Replace deterministic story intelligence with evaluated semantic
   clustering/claim extraction while retaining direct citation checks.

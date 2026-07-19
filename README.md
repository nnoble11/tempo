# Tempo

Tempo is a mobile-first personal briefing system that gives each user the right
information, at the right time, in the right amount.

The product is centered on a finite, citation-grounded daily briefing. Users
choose what they care about and how much time they have; Tempo selects,
deduplicates, ranks, and budgets meaningful updates to fit that time.

## Repository status

Tempo now has an integrated testable path from account creation and normalized
source intelligence to a scheduled, finite briefing on iOS, Android, and the
responsive web companion. The implemented slices cover secure Supabase
authentication; atomic preference and interest onboarding; credential-free
first-party ingestion; lease-backed asynchronous story intelligence; scheduled
per-user selection and grounded generation; immutable canonical briefing
persistence; verified, quiet-hour-aware delivery; Expo push receipt cleanup;
feedback interactions; and canonical mobile/web reading routes.

Onboarding, canonical generation, delivery scheduling, and feedback writes are
user-scoped and idempotent. Scheduled workers use observable PostgreSQL records,
expiring leases, and bounded retries. A stored briefing snapshots both its
transparent ranking result and the claims and citations shown to the user, so
later reusable-story updates cannot rewrite briefing history or make a delivery
channel invent different editorial content.

The product and engineering constraints in [AGENTS.md](./AGENTS.md) are
authoritative. The initial system boundaries are documented in
[docs/architecture.md](./docs/architecture.md), and accepted architectural
decisions live under [docs/decisions](./docs/decisions). The first transparent
scoring and selection model is documented in
[docs/ranking.md](./docs/ranking.md). See
[docs/data-model.md](./docs/data-model.md) for persistence and
[docs/api.md](./docs/api.md) for the current endpoint surface. Source selection,
normalization, and operating constraints are in
[docs/integrations.md](./docs/integrations.md). The grounded story aggregate is
documented in [docs/story-intelligence.md](./docs/story-intelligence.md), and
the current clients are documented in [docs/mobile.md](./docs/mobile.md) and
[docs/web.md](./docs/web.md).

## Prerequisites

- Node.js 22 or newer
- pnpm 11
- PostgreSQL 14 or newer for integration tests, or `TEST_DATABASE_URL`

Python tooling will be added when claim extraction, clustering, or other ML
workloads require it. Credential-free feed transport and normalization remain in
TypeScript so their contracts can be shared with the API and data layer.

## Local development

```bash
pnpm install
pnpm check
```

Useful commands:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm db:migrate
pnpm ingest:sources
pnpm process:intelligence
pnpm generate:briefings
pnpm deliver:briefings
pnpm dev:api
pnpm dev:mobile
pnpm dev:web
pnpm test:env:bootstrap
pnpm test:env:smoke
pnpm test:env:start
```

Copy `.env.example` to `.env` or provide the documented environment variables
through your runtime. Database-backed commands require `DATABASE_URL`; run
migrations first. The API also requires `SUPABASE_URL`. Mobile authentication
requires `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Physical-device push registration also
requires `EXPO_PUBLIC_EAS_PROJECT_ID`.

Invoke `pnpm generate:briefings` and `pnpm deliver:briefings` from an external
scheduler. Generation creates at most one scheduled run per user and local date,
persists the canonical briefing, and schedules configured delivery records.
Delivery sends due records through Expo Push and any configured Resend or Twilio
adapters. See the [generation](./docs/runbooks/briefing-generation.md) and
[delivery](./docs/runbooks/briefing-delivery.md) runbooks before enabling either
command in a shared environment.

For a repeatable shared test setup, copy `.env.test.example`, provide a
test-only PostgreSQL/Supabase project, run `pnpm test:env:bootstrap`, and then
run `pnpm test:env:start`. The bootstrap creates one fixed test identity,
interest, source item, grounded story, and briefing; rerunning it is idempotent.
See the [test-environment runbook](./docs/runbooks/test-environment.md).

## Current workspace structure

```text
tempo/
├── apps/
│   ├── api/
│   ├── delivery/
│   ├── generation/
│   ├── ingestion/
│   ├── intelligence/
│   ├── mobile/
│   ├── test-env/
│   └── web/
├── packages/
│   ├── contracts/
│   ├── database/
│   ├── delivery/
│   ├── domain/
│   ├── generation/
│   ├── ingestion/
│   ├── intelligence/
│   ├── ranking/
│   └── source-adapters/
├── infrastructure/
│   └── migrations/
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── data-model.md
│   └── decisions/
├── AGENTS.md
└── README.md
```

The runners are bounded one-shot processes coordinated through PostgreSQL
records rather than a general-purpose broker. Deployment schedules invoke them
repeatedly.

## Proven invariants

The current implementation proves these invariants:

1. Ranking retains transparent component scores.
2. A briefing plan never exceeds the user's time budget.
3. Selection favors both relevance and cross-interest diversity.
4. Every selected factual update has at least one citation.
5. The reusable candidate layer remains separate from the personalized plan.
6. User-owned queries derive ownership only from a verified token subject.
7. Migrations are idempotent and repository behavior is tested against
   PostgreSQL.
8. Source adapters preserve canonical URLs, deterministic content hashes, and
   per-entry rejection details across differing feed shapes.
9. Scheduled workers claim due sources with expiring leases and bounded
   retry/backoff behavior.
10. Every stored claim retains same-cluster source provenance, while reusable
    candidate scores exclude personalized signals.
11. Canonical briefings snapshot ranking, claims, and citations within a hard
    duration limit.
12. Generation and feedback retries cannot create duplicate records or reuse an
    idempotency key for different input.
13. A user cannot read or interact with another user's briefing.
14. The mobile Today experience has explicit loading, error, empty, ready, and
    completion states with no infinite feed.
15. Onboarding commits preferences and interests atomically and safely returns
    the same account state on a matching retry.
16. Each eligible user receives at most one scheduled generation run per local
    date, including across daylight-saving transitions.
17. A failed post-generation action resumes from the attached canonical briefing
    instead of generating a duplicate.
18. Push, email, and SMS payloads are immutable renderings of one canonical
    briefing and are unique per briefing, channel, and destination.
19. External delivery attempts use expiring leases, bounded backoff, and
    auditable provider results.
20. Email and SMS endpoints cannot receive a delivery until their identity is
    verified; the authenticated account email is trusted directly.
21. External deliveries move past quiet hours in the user's IANA timezone,
    including daylight-saving boundaries.
22. Expo receipt reconciliation disables `DeviceNotRegistered` endpoints while
    preserving delivery history.
23. Notification opens deep-link to the owned canonical briefing.
24. Normalized source changes enqueue one idempotent, retryable story
    intelligence job.
25. Test bootstrap, repeat bootstrap, and guarded reset are exercised against a
    temporary real PostgreSQL instance.

Live calendar-provider authorization, subscriptions, commercial recommendations,
and model-based semantic intelligence remain outside the implemented product
slice. Recommendation preferences exist but remain disabled by default and do
not affect editorial ranking.

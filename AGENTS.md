# CLAUDE.md — Tempo

## 1. Product Overview

**Working name:** Tempo  
**Tagline:** The right information, at the right time, in the right amount.

Tempo is a mobile-first personal briefing system for consumers with broad interests, with an initial focus on students and busy professionals.

Users tell Tempo what they care about, how deeply they care about it, when they are available, and how much time they want to spend. Tempo continuously gathers information from relevant sources, removes duplication and low-value noise, ranks updates for personal relevance, and produces an `x`-minute briefing.

Tempo is not primarily a newsletter product. Email is one delivery channel. The product's core value is deciding:

1. What matters to this specific user?
2. What is new or meaningfully changed?
3. When is the user most receptive?
4. What format and length fit that moment?

The long-term vision is a personal information layer that can span any topic: sports, finance, local news, science, entertainment, travel, hobbies, gaming, culture, professional interests, products, people, companies, events, and more.

---

## 2. Core Product Thesis

People do not necessarily stop reading newsletters because they dislike curated information. They stop because newsletters:

- arrive in an overloaded inbox;
- arrive at the wrong time;
- have a fixed length regardless of available time;
- repeat information the reader already knows;
- mix important updates with filler;
- do not adapt to the reader's behavior;
- are disconnected from the reader's existing workflow.

Tempo should turn a passive content subscription into a context-aware habit.

The primary habit is a scheduled daily briefing. Secondary behaviors are:

- context-aware briefings offered when the user has an open calendar window;
- high-importance alerts for developments that should not wait for the next briefing;
- optional email and SMS delivery;
- reviewing, saving, expanding, and discussing updates in the mobile or web app.

---

## 3. Target Users

### Initial audience

Consumers with broad interests, leaning toward:

- students who want to remain informed without constantly checking many sources;
- busy professionals who have limited reading time;
- curious generalists who follow unrelated topics;
- people who want high-signal updates but dislike traditional newsletters.

### Initial jobs to be done

- “Give me the most important updates across everything I care about.”
- “Fit the briefing into the amount of time I have.”
- “Tell me only when something is genuinely important.”
- “Help me understand why an update matters.”
- “Remember what I already know and avoid repeating it.”
- “Let me go deeper when I choose, without forcing depth on every item.”

### Non-target users for the MVP

Do not optimize the initial product for:

- enterprise competitive intelligence;
- large research teams;
- real-time financial trading;
- emergency or safety-critical alerts;
- regulated professional advice;
- fully autonomous decision-making.

These may become future product lines, but they should not distort the consumer MVP.

---

## 4. Product Principles

1. **Relevance over volume**  
   Showing fewer, better items is preferable to maximizing engagement through feed volume.

2. **Time-aware by default**  
   Every briefing should have an explicit target duration.

3. **Mobile-first, not mobile-only**  
   Mobile owns delivery and daily habit formation. Web is the companion for setup, management, saved content, and deeper reading.

4. **Progressive disclosure**  
   Start with the core takeaway. Allow the user to expand into context, explanation, source comparison, and original material.

5. **Citations are mandatory**  
   Every factual update must link to its underlying sources. The product must clearly distinguish source facts, model-generated synthesis, and inference.

6. **Novelty matters**  
   Prefer “what changed” over repeating static background.

7. **User control beats hidden automation**  
   The MVP learns from explicit preferences and reading behavior. It should not require access to email or browsing history.

8. **No disguised advertising**  
   Product recommendations and affiliate content must be labeled and globally toggleable by the user.

9. **Cross-topic by design**  
   Do not hard-code the architecture around technology news or any single vertical.

10. **Trust is a product feature**  
    Users should understand why an item was selected, why it was delivered now, and which sources support it.

---

## 5. MVP Experience

### Primary workflow

1. User creates an account.
2. User adds interests using:
   - broad topics;
   - specific entities;
   - natural-language instructions;
   - optional connected calendar;
   - suggested interests during onboarding.
3. User selects:
   - preferred daily briefing time;
   - default briefing duration;
   - preferred channels;
   - alert sensitivity;
   - depth or expertise level for each interest.
4. Tempo gathers source material continuously.
5. The system normalizes, deduplicates, clusters, and ranks candidate updates.
6. Tempo generates a cohesive `x`-minute briefing.
7. The briefing is delivered primarily through a mobile notification and app experience.
8. The user can:
   - mark an item useful or not useful;
   - follow or mute related entities;
   - save it;
   - expand it;
   - open original sources;
   - ask for a simpler or deeper explanation;
   - defer it to a later briefing.
9. Reading and feedback behavior updates future ranking.

### Daily briefing

The daily briefing is the MVP’s emphasized habit.

A briefing should contain:

- a one-sentence “why today matters” overview;
- a small number of ranked updates;
- estimated reading time;
- a concise summary for each update;
- why the item matters to this user;
- what is new compared with previous coverage;
- source links;
- optional expansion;
- optional product recommendations only when enabled.

### Context-aware briefing

With calendar permission, Tempo can detect usable free windows and offer, rather than automatically force, a briefing.

Example:

> You have 8 minutes before your next event. Three meaningful updates are ready.

MVP calendar behavior should remain simple:

- read availability windows;
- avoid reading private event descriptions unless required and clearly authorized;
- never modify the calendar without explicit user action;
- allow calendar-based briefing suggestions to be disabled.

### Important-event alerts

Alerts should be rare and high-confidence.

An alert candidate should score highly on several dimensions:

- personal relevance;
- urgency;
- novelty;
- source credibility;
- magnitude;
- time sensitivity;
- confidence;
- user-selected alert sensitivity.

The interface should explain why the user received the alert.

---

## 6. Interest Model

Users can define interests in four ways.

### Topics

Examples:

- college football;
- venture capital;
- climate science;
- Japanese cooking;
- local Dallas events.

### Entities

Examples:

- a company;
- person;
- sports team;
- athlete;
- game;
- film franchise;
- university;
- stock;
- city;
- product;
- scientific field.

### Natural-language instructions

Examples:

- “Tell me about major AI model releases, but skip minor benchmark posts.”
- “Track the Cowboys closely during the season and only major news otherwise.”
- “Show me affordable flights to Japan, but do not send product recommendations.”
- “Explain economics at an undergraduate level.”

### Connected context

For the MVP:

- calendar availability;
- explicit preferences;
- read, skip, save, expand, dismiss, and source-click behavior.

Later:

- email;
- browser history;
- Slack or Teams;
- learning systems;
- task managers;
- music and podcast activity;
- location and commute state, with explicit permission.

### Interest attributes

Each followed interest should support:

- `name`;
- `type`;
- `description`;
- `importance`;
- `expertise_level`;
- `desired_depth`;
- `alert_sensitivity`;
- `preferred_sources`;
- `blocked_sources`;
- `keywords`;
- `excluded_keywords`;
- `active`;
- `created_at`;
- `last_interacted_at`.

---

## 7. Ranking Model

Do not use a single opaque “relevance” score without retaining component scores.

Each candidate story should be scored on:

- personal relevance;
- global importance;
- novelty;
- urgency;
- credibility;
- source diversity;
- user interest strength;
- behavioral affinity;
- recency;
- redundancy penalty;
- fatigue penalty;
- clickbait penalty;
- commercial-content penalty;
- confidence.

A starting conceptual formula:

```text
final_score =
  personal_relevance
  * confidence
  * credibility
  * novelty
  * timing_fit
  + urgency_bonus
  + explicit_interest_bonus
  - redundancy_penalty
  - fatigue_penalty
  - low_quality_penalty
```

This formula is guidance, not a permanent implementation.

### Behavioral signals in the MVP

Positive:

- opens briefing;
- expands item;
- saves item;
- visits source;
- follows related entity;
- explicitly marks useful;
- asks a follow-up question.

Negative:

- dismisses item;
- marks irrelevant;
- repeatedly skips an interest;
- mutes source or entity;
- ignores similar alerts.

Do not interpret every non-click as negative. A user may read the summary without opening it.

### Explore versus exploit

Reserve a small portion of briefing capacity for adjacent or emerging interests. Exploration must remain constrained and removable.

---

## 8. Briefing Composition

The system should first select and budget information, then generate prose.

Do not ask an LLM to ingest an unlimited article set and independently decide the entire briefing.

### Generation pipeline

1. Retrieve candidate clusters.
2. Score candidate clusters.
3. Select clusters based on time budget and diversity.
4. Allocate a word or audio-time budget to each cluster.
5. Extract grounded claims and supporting citations.
6. Generate the briefing.
7. Run factuality and citation checks.
8. Run duplication, tone, and duration checks.
9. Store the final briefing and delivery variants.

### Duration targets

Support user-selected durations such as:

- 2 minutes;
- 5 minutes;
- 10 minutes;
- 15 minutes;
- custom duration.

Estimate reading time conservatively. The generator must fit the target rather than merely label a long briefing “five minutes.”

### Item structure

Each item should include:

- headline;
- one- or two-sentence takeaway;
- why it matters;
- what changed;
- confidence;
- citations;
- optional deeper context;
- related entities;
- optional recommendation disclosure.

### Cohesive narrative

The briefing should feel edited rather than concatenated. It may connect related developments across topics, but it must not create unsupported causal relationships.

---

## 9. Sources and Ingestion

Tempo may use:

- official APIs;
- licensed data APIs;
- RSS and Atom feeds;
- public webpages;
- structured datasets;
- newsletters the user is authorized to access;
- carefully governed scraping;
- user-submitted sources.

### Source priority

Prefer, in order:

1. first-party and official sources;
2. high-quality primary reporting;
3. trusted domain-specific publications;
4. aggregators and secondary summaries;
5. community sources, clearly labeled.

### Scraping policy

Scraping is allowed as part of the product strategy, but implementation must:

- respect authentication boundaries;
- respect robots directives where applicable;
- rate-limit requests;
- cache aggressively;
- avoid bypassing paywalls or access controls;
- preserve source attribution;
- store only what is necessary;
- maintain per-source adapters;
- support takedown and block rules;
- consult legal counsel before commercial scale.

Do not assume that publicly accessible content is automatically unrestricted for commercial reuse.

### Canonical content model

Normalize every source item into a common structure:

```ts
type SourceItem = {
  id: string;
  sourceId: string;
  canonicalUrl: string;
  title: string;
  author?: string;
  publishedAt?: string;
  discoveredAt: string;
  language: string;
  rawText?: string;
  cleanedText?: string;
  excerpt?: string;
  contentHash: string;
  entities: EntityRef[];
  topics: TopicRef[];
  metadata: Record<string, unknown>;
};
```

---

## 10. Caching and Cost Strategy

Caching is a core advantage.

Separate the pipeline into reusable and personalized layers.

### Reusable global layer

Cache:

- fetched source content;
- cleaned text;
- embeddings;
- entity extraction;
- topic classification;
- story clustering;
- claim extraction;
- baseline summaries;
- importance scores;
- source credibility metadata.

### Personalized layer

Generate per user:

- final ranking;
- time-budget allocation;
- “why this matters to you” text;
- personalized depth;
- ordering;
- channel-specific formatting;
- final briefing narrative.

### Cache keys

Cache keys should include relevant dimensions such as:

- cluster ID;
- language;
- expertise level;
- summary depth;
- model version;
- prompt version;
- freshness window.

### Cost controls

- batch embedding and classification jobs;
- use smaller models for extraction and classification;
- reserve stronger models for final synthesis and difficult verification;
- avoid regenerating unchanged clusters;
- maintain prompt and model observability;
- enforce per-user and per-briefing token budgets;
- retain deterministic intermediate artifacts;
- build cost dashboards before meaningful scale.

---

## 11. Delivery Channels

### MVP channels

1. Mobile push notifications
2. In-app briefing
3. Email
4. SMS
5. Calendar-aware suggestions

### Channel rules

- The in-app briefing is canonical.
- Email and SMS are rendered variants of the same briefing data.
- SMS should usually link to the briefing rather than contain a full long-form briefing.
- Push notifications should contain only enough information to make the value clear.
- Users control channel, quiet hours, urgency, and frequency.
- Do not send the same update redundantly across every channel unless the user requests it.
- Respect local time zones and daylight saving time.
- Provide one-tap pause, mute, and reschedule controls.

### Future channels

- browser extension and new-tab experience;
- Slack and Microsoft Teams;
- audio and podcast feed;
- smartwatch;
- in-car systems;
- task managers;
- learning-management systems;
- public API and webhooks.

---

## 12. Monetization

### Initial model

**Freemium subscription plus optional affiliate revenue.**

### Free tier

Possible limits:

- limited number of interests;
- one daily briefing;
- limited briefing lengths;
- standard source set;
- basic feedback controls;
- limited important-event alerts.

### Paid consumer tier

Possible features:

- unlimited or higher interest limits;
- multiple briefing schedules;
- custom briefing durations;
- more alerts;
- advanced source controls;
- deeper explanations;
- full history and search;
- audio briefings;
- calendar-aware suggestions;
- custom natural-language monitoring rules;
- premium data sources where licensing permits.

### Affiliate revenue

Rules:

- globally toggleable;
- disabled by default or made very explicit during onboarding;
- recommendations must be clearly labeled;
- affiliate incentives must not influence factual-news ranking;
- organic and sponsored ranking systems must remain separate;
- explain why a recommendation appeared;
- never fabricate urgency, popularity, savings, or endorsements.

### Other models to consider later

- family plan;
- student plan;
- team workspaces;
- professional vertical add-ons;
- premium data partnerships;
- paid publisher channels;
- white-label briefing infrastructure;
- API access.

Advertising should not be introduced until trust and product-market fit are established.

---

## 13. Recommended Technical Architecture

Use a monorepo.

### Client applications

#### Mobile

- **Expo with React Native**
- TypeScript
- Expo Router
- TanStack Query
- local secure storage for session material
- Expo Notifications initially
- platform-native calendar permission layer
- accessible component primitives

Why:

- one codebase for iOS and Android;
- strong fit for notification-heavy consumer apps;
- rapid iteration;
- over-the-air update support where appropriate;
- shared TypeScript types with web and API packages.

#### Web

- **Next.js App Router**
- TypeScript
- server components where useful
- TanStack Query only for client-managed asynchronous state
- responsive interface
- web onboarding, interest management, billing, archive, search, and long-form reading

### Backend

#### API and application layer

Start with:

- **TypeScript**
- **NestJS or a well-structured Fastify service**
- REST endpoints first
- OpenAPI-generated clients
- schema validation with Zod
- background jobs separated from request handling

Use NestJS when a larger team benefits from enforced structure. Use Fastify when keeping the initial service lean. Do not build both.

#### Data and authentication

- **PostgreSQL**
- **Supabase managed Postgres and Auth** for the MVP
- Row Level Security where appropriate
- `pgvector` for embeddings at initial scale
- object storage for permitted raw artifacts and generated audio

Do not make core domain logic dependent on proprietary Supabase-only behavior. Keep a migration path to standard PostgreSQL infrastructure.

#### Ingestion and ML workers

- **Python**
- FastAPI for internal ML endpoints only when needed
- Celery workers
- Redis as broker and short-lived cache
- Pydantic models
- source adapters with typed outputs
- provider-agnostic LLM interface

Python is preferred for ingestion, extraction, ranking experimentation, and ML tooling. TypeScript owns the user-facing product API.

#### Workflow orchestration

For MVP:

- Celery + Redis;
- scheduled jobs;
- explicit idempotency keys;
- retries with exponential backoff;
- dead-letter handling;
- job observability.

Consider Temporal later if workflows become long-running, stateful, and difficult to reason about.

#### Search

MVP:

- PostgreSQL full-text search;
- `pgvector`;
- structured entity and topic filters.

Consider a dedicated search engine only after concrete scale or relevance limitations appear.

#### Hosting

A practical initial setup:

- Vercel for Next.js;
- EAS for mobile builds;
- Supabase for database, auth, and storage;
- a container host such as Fly.io, Render, Railway, or AWS for API and workers;
- managed Redis;
- CDN and edge caching where appropriate.

Avoid premature Kubernetes.

### Third-party integrations

- calendar: Google Calendar first, then Microsoft;
- email: transactional provider such as Resend, Postmark, or SES;
- SMS: Twilio or equivalent;
- payments: Stripe;
- product analytics: privacy-conscious product analytics;
- errors: Sentry;
- tracing and logs: OpenTelemetry-compatible stack.

Do not tightly couple domain logic to one vendor. Wrap each external provider behind an interface.

---

## 14. Suggested Monorepo Structure

```text
tempo/
├── apps/
│   ├── mobile/
│   ├── web/
│   ├── api/
│   └── worker/
├── packages/
│   ├── contracts/
│   ├── database/
│   ├── domain/
│   ├── ranking/
│   ├── prompts/
│   ├── source-adapters/
│   ├── ui/
│   ├── analytics/
│   └── config/
├── infrastructure/
│   ├── docker/
│   ├── migrations/
│   └── deployment/
├── docs/
│   ├── architecture/
│   ├── product/
│   ├── decisions/
│   └── runbooks/
├── scripts/
├── CLAUDE.md
└── README.md
```

The Python worker may live in the same monorepo while using its own package manager and tooling.

---

## 15. Core Domain Model

Initial entities:

- `User`
- `UserPreference`
- `Interest`
- `Topic`
- `Entity`
- `UserInterest`
- `Source`
- `SourceItem`
- `StoryCluster`
- `Claim`
- `Citation`
- `CandidateUpdate`
- `Briefing`
- `BriefingItem`
- `Delivery`
- `Interaction`
- `CalendarConnection`
- `AvailabilityWindow`
- `AlertRule`
- `Recommendation`
- `Subscription`
- `AffiliatePreference`

### Key relationships

- A user follows many interests.
- An interest may map to many topics and entities.
- Many source items may belong to one story cluster.
- A story cluster contains grounded claims and citations.
- A briefing contains personalized briefing items.
- A briefing item references a reusable story cluster.
- Every delivery references one canonical briefing.
- Interactions update personalization features.
- Commercial recommendations are stored separately from editorial updates.

---

## 16. Example Database Tables

This is a conceptual starting point, not final SQL.

### `users`

- `id`
- `email`
- `timezone`
- `locale`
- `default_briefing_minutes`
- `created_at`
- `updated_at`

### `user_interests`

- `id`
- `user_id`
- `interest_id`
- `importance`
- `expertise_level`
- `desired_depth`
- `alert_sensitivity`
- `active`
- `created_at`
- `updated_at`

### `source_items`

- `id`
- `source_id`
- `canonical_url`
- `title`
- `published_at`
- `discovered_at`
- `content_hash`
- `cleaned_text`
- `language`
- `metadata_json`

### `story_clusters`

- `id`
- `canonical_title`
- `summary`
- `first_seen_at`
- `last_updated_at`
- `importance_score`
- `novelty_score`
- `confidence_score`
- `status`

### `briefings`

- `id`
- `user_id`
- `target_minutes`
- `actual_word_count`
- `scheduled_for`
- `generated_at`
- `status`
- `overview`
- `prompt_version`
- `model_version`

### `briefing_items`

- `id`
- `briefing_id`
- `story_cluster_id`
- `position`
- `headline`
- `takeaway`
- `why_it_matters`
- `what_changed`
- `estimated_seconds`
- `personal_relevance_score`

### `interactions`

- `id`
- `user_id`
- `briefing_item_id`
- `event_type`
- `value`
- `occurred_at`
- `metadata_json`

---

## 17. API Surface

Initial endpoint groups:

```text
/auth
/users/me
/preferences
/interests
/entities
/topics
/sources
/briefings
/briefings/:id/items
/briefings/:id/feedback
/alerts
/deliveries
/calendar/connections
/calendar/availability
/recommendation-preferences
/subscriptions
```

Requirements:

- use versioned APIs;
- validate all inputs;
- return stable error shapes;
- use idempotency keys for generation and delivery requests;
- paginate list endpoints;
- authorize every user-owned resource;
- maintain OpenAPI documentation;
- never expose model-provider secrets to clients.

---

## 18. LLM and Prompting Rules

### Provider abstraction

All LLM calls must use a provider-neutral interface.

Support:

- task name;
- model class;
- temperature;
- token budget;
- timeout;
- retry policy;
- prompt version;
- structured output schema;
- cost metadata;
- latency metadata.

### Structured output

Use schemas for:

- entity extraction;
- topic classification;
- claim extraction;
- ranking features;
- summary generation;
- briefing planning;
- citation mapping;
- safety classification.

Do not parse critical outputs from loosely formatted prose.

### Grounding

- Generate only from selected source material.
- Preserve claim-to-source mappings.
- Refuse to present an unsupported statement as fact.
- Mark uncertain or conflicting claims.
- Prefer multiple independent sources for high-impact claims.
- Preserve dates, quantities, names, and attribution precisely.
- Do not cite a source that does not support the adjacent claim.

### Prompt versioning

Every production prompt must have:

- a stable identifier;
- version;
- owner;
- purpose;
- input schema;
- output schema;
- evaluation set;
- changelog.

Prompts belong in the repository, not hidden exclusively in a vendor dashboard.

---

## 19. Privacy, Security, and Safety

### Privacy

- Collect the minimum data needed.
- Explain why each permission is requested.
- Calendar access must be optional.
- Separate calendar availability from private event content where possible.
- Allow export and deletion of user data.
- Do not sell personal interest or behavioral data.
- Do not use personal data for model training without explicit consent.
- Provide clear controls for personalization history.

### Security

- Encrypt data in transit and at rest.
- Store secrets in managed secret storage.
- Use least-privilege service roles.
- Apply rate limits.
- Audit administrative access.
- Protect ingestion from prompt injection and malicious webpage content.
- Sanitize rendered content.
- Treat fetched content as untrusted input.
- Maintain dependency and container scanning.
- Back up PostgreSQL and test restoration.

### High-risk topics

For medical, legal, financial, safety, or emergency content:

- present informational summaries, not personalized professional advice;
- emphasize primary and authoritative sources;
- include appropriate caution;
- avoid urgent alerts unless source confidence is very high;
- never imply guaranteed outcomes.

---

## 20. Product Recommendations and Affiliate Integrity

Product recommendations are a separate content class.

Requirements:

- user-level on/off toggle;
- clear “affiliate” or “sponsored” label;
- explanation of recommendation rationale;
- no insertion into unrelated editorial updates;
- no ranking boost to news because a related affiliate offer exists;
- no pay-to-play source credibility;
- no fabricated comparisons;
- historical logging of why each recommendation was shown.

A user who disables recommendations should not receive disguised commercial content.

---

## 21. Analytics and Success Metrics

### North-star candidate

**Weekly useful briefing minutes consumed**

This should combine:

- briefing opens;
- estimated read completion;
- explicit usefulness;
- saves and expansions;
- low unsubscribe or mute rates.

Do not use raw time-in-app as the primary objective.

### MVP metrics

- onboarding completion;
- interests added;
- daily briefing open rate;
- seven-day and thirty-day retention;
- useful/not-useful ratio;
- average items expanded;
- source click-through;
- alert mute rate;
- notification disable rate;
- briefing completion estimate;
- percentage of briefings within target duration;
- generation cost per active user;
- duplicate-item rate;
- unsupported-claim rate;
- paid conversion;
- recommendation opt-in and opt-out rates.

### Guardrail metrics

- excessive notifications;
- irrelevant alert reports;
- citation errors;
- stale stories;
- repeated stories;
- user distrust reports;
- source complaints;
- affiliate-driven ranking drift.

---

## 22. MVP Scope

### Must have

- iOS and Android mobile app;
- responsive web companion;
- authentication;
- topic, entity, and natural-language interest creation;
- daily scheduled `x`-minute briefing;
- mobile push;
- in-app canonical briefing;
- email delivery;
- SMS link delivery;
- optional calendar availability connection;
- explicit feedback;
- reading-behavior signals;
- source citations;
- story deduplication;
- basic caching;
- recommendation preference toggle;
- freemium entitlement framework;
- observability and cost tracking.

### Should have

- saved items;
- briefing history;
- source controls;
- mute topic/entity;
- defer to next briefing;
- “explain more” and “explain simply”;
- basic important-event alerts;
- basic search.

### Not in MVP

- full podcast generation;
- browser history ingestion;
- email inbox ingestion;
- Slack or Teams;
- collaborative workspaces;
- autonomous agent actions;
- public developer API;
- complex knowledge graph visualization;
- enterprise administration;
- dozens of calendar providers;
- highly granular location tracking.

---

## 23. Roadmap

### Phase 0 — Validation

- interview students and busy professionals;
- prototype onboarding and briefing screens;
- manually produce personalized briefings;
- test 2-, 5-, and 10-minute formats;
- validate preferred delivery moments;
- measure whether calendar-aware prompts feel helpful or intrusive;
- test willingness to pay.

### Phase 1 — Core MVP

- build mobile and web foundations;
- implement interests;
- ingest a limited but cross-domain source set;
- cluster and deduplicate stories;
- generate daily briefings;
- push, email, and SMS delivery;
- explicit feedback;
- basic calendar availability;
- freemium limits.

### Phase 2 — Personalization

- improve behavioral ranking;
- add adjacent-interest exploration;
- richer source preferences;
- alert calibration;
- better “what changed” memory;
- recommendation system with strict disclosure.

### Phase 3 — Workflow expansion

- browser extension;
- audio briefing;
- Slack and Teams;
- Microsoft Calendar;
- task-manager integrations;
- shareable briefings;
- family and team plans.

### Phase 4 — Platform

- user-created briefing templates;
- publisher channels;
- external API;
- third-party integrations;
- premium vertical data;
- professional and enterprise editions.

---

## 24. Design Direction

Tempo should feel calm, useful, and deliberate—not like an infinite social feed.

### Visual principles

- clear hierarchy;
- high readability;
- generous spacing;
- low visual noise;
- explicit time estimates;
- restrained motion;
- strong accessibility;
- light and dark themes;
- no engagement traps.

### Primary mobile navigation

Possible tabs:

1. Today
2. Explore
3. Saved
4. Interests
5. Profile

Avoid adding a separate tab for every delivery channel.

### Briefing interaction

- show total estimated time;
- permit “make it shorter” before reading;
- support item-level expansion;
- maintain reading position;
- allow swipe actions for save, less like this, and later;
- show citations without making the main summary visually dense.

### No infinite scroll as the core experience

The daily briefing should have a clear end. Users should feel informed and done.

---

## 25. Engineering Standards

### General

- prefer simple, explicit implementations;
- avoid premature abstraction;
- keep domain logic independent from UI and vendors;
- use strict typing;
- validate at system boundaries;
- make background jobs idempotent;
- make retries safe;
- log structured events;
- include correlation IDs;
- add migrations for every schema change;
- never modify production data manually without an audited script.

### TypeScript

- enable strict mode;
- avoid `any`;
- use discriminated unions for state;
- use Zod at network and external-data boundaries;
- keep React components focused;
- separate server state from local UI state;
- avoid unnecessary global state.

### Python

- use type annotations;
- use Pydantic for external and job payloads;
- format and lint consistently;
- isolate source-specific parsing;
- write deterministic pure functions for ranking features where possible;
- pin dependencies with a lockfile.

### Testing

Required layers:

- unit tests for ranking, duration allocation, and normalization;
- contract tests for source adapters;
- integration tests for database and queues;
- end-to-end tests for onboarding and briefing consumption;
- prompt evaluations for factuality, citations, relevance, and length;
- delivery tests for timezone and quiet-hour behavior.

### Pull requests

Each pull request should include:

- problem;
- approach;
- tradeoffs;
- tests;
- screenshots for UI work;
- migration notes;
- rollout or rollback considerations;
- cost impact for model or data changes.

---

## 26. Instructions for Claude Code

When working in this repository:

1. Read this file before proposing architecture or code.
2. Preserve the mobile-first, time-aware product thesis.
3. Do not turn the product into a generic infinite news feed.
4. Do not assume the product is technology-specific.
5. Keep the daily `x`-minute briefing as the primary MVP habit.
6. Treat push, email, SMS, and calendar as delivery and context layers around one canonical briefing.
7. Maintain citations and source provenance through every transformation.
8. Separate reusable story processing from personalized generation.
9. Keep editorial ranking separate from affiliate recommendations.
10. Prefer explicit user control and reversible personalization.
11. Do not add a vendor dependency without documenting a migration path.
12. Do not introduce infrastructure such as Kubernetes, Kafka, or multiple databases without demonstrated need.
13. Do not expose private calendar details in logs, prompts, or analytics.
14. Do not scrape sources in ways that bypass authentication, paywalls, or technical protections.
15. When requirements are ambiguous, choose the smallest implementation that preserves future flexibility.
16. Before coding, inspect existing patterns and reuse them.
17. After coding, run relevant linting, type checks, tests, and builds.
18. Report what changed, what was tested, and any known limitations.
19. For consequential architecture changes, add an ADR under `docs/decisions/`.
20. Never claim a feature is complete unless its critical path is tested.

### Implementation behavior

- Make small, coherent changes.
- Do not rewrite unrelated code.
- Avoid placeholder code in production paths.
- Use feature flags for incomplete user-facing functionality.
- Preserve backward compatibility unless a migration is included.
- Prefer repository-local documentation over undocumented assumptions.
- Ask for clarification only when a decision is irreversible or materially changes product intent; otherwise make a reasonable documented choice.

---

## 27. Initial Architecture Decisions

### ADR-001: Mobile-first with web companion

Decision:

- Expo/React Native for mobile.
- Next.js for web.
- Shared TypeScript contracts and UI tokens where practical.

Reason:

The product’s differentiator depends on timely, context-aware delivery, which is strongest on mobile. Web remains important for configuration and deeper consumption.

### ADR-002: Canonical briefing model

Decision:

All channels render from a single stored briefing and structured set of briefing items.

Reason:

This prevents channel-specific factual drift and makes delivery auditable.

### ADR-003: Reusable global intelligence layer

Decision:

Source fetching, cleaning, extraction, clustering, and baseline summarization are shared. Final ranking and narrative are personalized.

Reason:

This is the foundation of the caching and unit-economics strategy.

### ADR-004: PostgreSQL first

Decision:

Use PostgreSQL for transactional data, full-text search, structured filtering, and initial vector retrieval.

Reason:

It minimizes infrastructure complexity and is adequate for the MVP.

### ADR-005: Explicit and behavioral personalization only

Decision:

The MVP uses user-entered preferences and in-product reading behavior, plus optional calendar availability.

Reason:

This provides personalization without requiring invasive account connections.

---

## 28. Open Questions

Track these without blocking initial development:

- What level of source breadth is required for a convincing cross-domain MVP?
- Which three interest categories produce the strongest early retention?
- Should recommendations default on or off?
- What alert frequency feels valuable rather than intrusive?
- How accurately can reading duration be predicted per user?
- Should the free tier include calendar awareness?
- Which calendar details are truly needed beyond free/busy windows?
- Should natural-language interest instructions compile into transparent rules users can edit?
- How should conflicting sources be represented in a short briefing?
- What percentage of a briefing should be exploratory content?
- Is “Tempo” sufficiently distinct for eventual branding and trademark use?

---

## 29. Immediate Build Order

1. Establish monorepo, formatting, linting, testing, and CI.
2. Define domain contracts and database schema.
3. Implement authentication and user preferences.
4. Build interest onboarding.
5. Implement a small set of source adapters across several unrelated domains.
6. Normalize, cluster, and deduplicate content.
7. Build ranking feature pipeline.
8. Build briefing planner with strict time budgets.
9. Generate grounded briefing items with citations.
10. Build the mobile Today experience.
11. Build web interest management and briefing archive.
12. Add push delivery.
13. Add email and SMS variants.
14. Add feedback and behavioral events.
15. Add basic calendar availability.
16. Add entitlement framework and recommendation toggle.
17. Instrument quality, retention, and cost metrics.
18. Run a small closed beta before broad source expansion.

---

## 30. Definition of MVP Success

The MVP is promising when a meaningful group of users:

- completes onboarding;
- follows several unrelated interests;
- opens the daily briefing repeatedly;
- finishes briefings near the selected duration;
- reports that the content is more relevant than generic newsletters;
- keeps notifications enabled;
- rarely marks alerts irrelevant;
- trusts the citations;
- returns after four weeks;
- demonstrates willingness to pay for stronger personalization, more interests, or richer delivery.

The goal is not to maximize content consumed. The goal is to help users become informed efficiently and then leave with confidence.


---

# 31. Repository Documentation Strategy

As the project grows, this repository should evolve from a single specification into a set of focused documents. `CLAUDE.md` (and `AGENTS.md`) should remain the entry point for AI coding agents, while the detailed documentation lives under `docs/`.

## Recommended Repository Layout

```text
tempo/
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── apps/
├── packages/
├── infrastructure/
├── scripts/
└── docs/
    ├── product.md
    ├── architecture.md
    ├── roadmap.md
    ├── data-model.md
    ├── ranking.md
    ├── prompts.md
    ├── integrations.md
    ├── security.md
    ├── deployment.md
    ├── api.md
    ├── contributing.md
    └── decisions/
        ├── ADR-001-mobile-first.md
        ├── ADR-002-briefing-model.md
        └── ...
```

## Purpose of Each Document

### README.md

The first document a developer should read.

Include:

- project overview;
- local development setup;
- environment variables;
- running mobile, web, API, and workers;
- testing;
- deployment overview;
- links to the rest of the documentation.

### AGENTS.md / CLAUDE.md

The instruction manual for AI coding agents.

Keep these focused on:

- product philosophy;
- engineering standards;
- architecture constraints;
- coding conventions;
- implementation priorities;
- links to detailed documentation.

Avoid duplicating long implementation details that already exist elsewhere.

### docs/product.md

The canonical product specification.

Should contain:

- vision;
- user personas;
- JTBD;
- UX philosophy;
- MVP;
- roadmap;
- monetization;
- feature specifications.

### docs/architecture.md

System architecture diagrams and explanations.

Include:

- service boundaries;
- request flow;
- ingestion pipeline;
- briefing generation pipeline;
- deployment topology;
- caching strategy.

### docs/data-model.md

All database entities, relationships, migrations, and ER diagrams.

### docs/ranking.md

The ranking system.

Document:

- scoring features;
- personalization;
- experimentation;
- evaluation;
- offline testing.

### docs/prompts.md

LLM prompt inventory and evaluation methodology.

### docs/integrations.md

External services, adapters, APIs, authentication flows, quotas, and provider abstractions.

### docs/security.md

Privacy model, permissions, authentication, secrets management, threat model, and compliance notes.

### docs/deployment.md

Infrastructure, CI/CD, staging, production, rollback procedures, monitoring, and backups.

### docs/api.md

Public and internal API reference.

### docs/contributing.md

Developer workflow:

- branching;
- pull requests;
- coding standards;
- testing requirements;
- release process.

### docs/decisions/

Architecture Decision Records (ADRs).

Every major architectural decision should be captured with:

- context;
- decision;
- alternatives considered;
- consequences;
- date.

## Documentation Rules

1. Keep one canonical source of truth for each topic.
2. Prefer linking instead of duplicating content.
3. Update documentation in the same pull request as significant code changes.
4. Create an ADR before making irreversible architectural decisions.
5. Treat documentation as production code.

---


## Evolution of This Document

This file is the canonical entry point for AI coding agents, but it should **not** grow indefinitely.

As the codebase matures (roughly once the project reaches 10,000–20,000 lines of code or the document becomes difficult to navigate), refactor this document into a concise high-level guide of approximately 200–400 lines.

At that stage:

- Keep `AGENTS.md` focused on product philosophy, architecture principles, coding standards, implementation priorities, and links to supporting documentation.
- Move detailed specifications into the appropriate files under `docs/`.
- Avoid duplicating information between documents. Every topic should have a single canonical source of truth.
- Prefer linking to documentation rather than copying large sections into `AGENTS.md`.
- Update `AGENTS.md` whenever a major architectural or product direction changes so AI agents always begin with an accurate overview.

The goal is for a new AI coding agent to understand the project by reading `AGENTS.md` first, then opening only the documentation relevant to the task at hand.

---


## Architecture Decision Records (ADR) Policy

All non-trivial architectural decisions must be documented with an Architecture Decision Record (ADR) before or alongside implementation.

Examples include, but are not limited to:

- adopting or replacing frameworks or major libraries;
- introducing new infrastructure (queues, databases, search engines, orchestration systems, caches, etc.);
- changing authentication or authorization models;
- modifying the ingestion, ranking, or briefing-generation pipelines;
- introducing new AI providers or changing LLM abstraction layers;
- major database schema or domain-model changes;
- monetization architecture that affects product behavior;
- significant API design changes;
- changes to deployment topology.

Each ADR should be stored under `docs/decisions/` and include:

1. Title
2. Status (Proposed, Accepted, Superseded, Deprecated)
3. Date
4. Context
5. Decision
6. Alternatives Considered
7. Consequences
8. Rollback or Migration Considerations (when applicable)

Guidelines:

- Reference relevant ADRs in pull requests that implement them.
- If an ADR supersedes an older one, link both documents.
- Do not silently reverse accepted architectural decisions—either update the existing ADR or create a new superseding ADR.
- AI coding agents should check for relevant ADRs before proposing architectural changes and should create a new ADR when making a significant design decision.

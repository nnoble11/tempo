# Source Integrations

Status: Source, identity, delivery, and device-context adapters Last updated:
2026-07-25

## Initial source set

Tempo begins with three credential-free, first-party feeds in unrelated domains:

| Source                         | Domain                          | Interface   | Starting interval |
| ------------------------------ | ------------------------------- | ----------- | ----------------- |
| NASA News Releases             | Science and space               | RSS 2.0     | 30 minutes        |
| Federal Reserve press releases | Economics and public policy     | RDF/RSS 1.0 | 15 minutes        |
| Library of Congress News       | Culture and public institutions | RSS 2.0     | 60 minutes        |

These sources exercise cross-domain normalization without API credentials,
licensed-content assumptions, authentication boundaries, or paywall handling.
The intervals are conservative configuration defaults, not promises about
publication cadence.

The registered endpoints are:

- NASA: `https://www.nasa.gov/news-release/feed/`
- Federal Reserve: `https://www.federalreserve.gov/feeds/press_all.xml`
- Library of Congress: `https://www.loc.gov/rss/pao/news.xml`

## Adapter contract

Every adapter exposes immutable source registration data and returns normalized
items with:

- a stable source key and source-provided external identifier;
- a canonical HTTP or HTTPS URL with fragments and known tracking parameters
  removed;
- title, optional author, optional publication time, and discovery time;
- language and a bounded plain-text excerpt;
- a deterministic SHA-256 hash of the normalized editorial fields;
- feed-specific metadata such as category labels and feed shape.

Malformed entries are rejected individually with their input position and
reason. One invalid item therefore does not discard the rest of a valid feed.
Critical output is validated by shared Zod schemas before persistence.

## Fetch behavior

The HTTP boundary:

- identifies itself with a Tempo user agent;
- accepts RSS, Atom, and XML representations;
- follows ordinary redirects;
- uses a 15-second timeout by default;
- sends `If-None-Match` and `If-Modified-Since` when prior metadata exists;
- handles `304 Not Modified` without reparsing or rewriting items;
- fails closed on non-success HTTP responses.

The database schema retains ETags, last-modified values, fetch timestamps,
failure counts, next-attempt times, and expiring leases for the scheduled
runner.

## Scheduled runner

`pnpm ingest:sources` performs one bounded ingestion cycle and then exits. An
external scheduler invokes that command at a regular cadence; the database,
rather than the scheduler interval, decides which sources are due.

Each cycle:

1. registers the adapters available to that deployment;
2. atomically leases due sources with `FOR UPDATE SKIP LOCKED`;
3. fetches claimed sources concurrently;
4. retries transient network, timeout, rate-limit, and server failures up to
   three total attempts by default;
5. avoids immediate retries for permanent HTTP errors or invalid feed shapes;
6. persists normalized items and a source's next-fetch time on success;
7. persists an exponentially backed-off next attempt and a bounded error summary
   on failure.

If a process exits unexpectedly, another invocation can reclaim the source after
its lease expires. Detailed operating instructions are in the
[source-ingestion runbook](./runbooks/source-ingestion.md).

## Persistence and provenance

Sources are registered separately from normalized source items. Items use a
unique `(source_id, external_id)` key, preserve their earliest discovery time,
and only update when the deterministic content hash changes.

Canonical URLs and source ownership remain attached to every item so later story
clusters, claims, citations, and briefing items can retain provenance. Raw
fetched content is treated as untrusted and is not rendered directly.

## Verification

Fixture contract tests cover:

- RSS 2.0 normalization and entity decoding;
- RDF/RSS 1.0 normalization;
- canonical URL cleanup and stable content hashing;
- partial success when a feed contains a malformed entry;
- conditional-request metadata and `304` behavior.

A PostgreSQL integration test applies the real ordered migrations and verifies
source registration; inserted, unchanged, and updated item outcomes; exclusive
leases; expired-lease recovery; and persisted success/failure state.

Fixtures are deterministic and intentionally avoid making the normal test suite
dependent on third-party availability. Live-source health belongs in an
operational smoke check when deployment monitoring is introduced.

## Supabase authentication

Supabase Auth is the initial identity provider. The mobile client uses only the
project URL and publishable key, persists native sessions through secure device
storage, and sends the resulting bearer access token to Tempo's API. The API
validates the project's issuer, audience, signature, expiration, and subject
through its JWKS; it never accepts a user ID from a request body.

The verifier and repositories remain provider-neutral interfaces. A migration to
another OpenID Connect provider would replace token verification and session UI
without changing application user IDs, ownership predicates, or domain services.

## Delivery providers

Delivery adapters consume a previously rendered and persisted payload. They do
not receive story candidates, prompts, or source text.

| Channel | Initial provider    | Configuration                                           |
| ------- | ------------------- | ------------------------------------------------------- |
| Push    | Expo Push Service   | optional `EXPO_ACCESS_TOKEN`                            |
| Email   | Resend              | `RESEND_API_KEY` and `RESEND_FROM_EMAIL` together       |
| SMS     | Twilio Messages API | account SID, auth token, and E.164 from number together |

The delivery runner always registers Expo Push. Resend and Twilio adapters are
registered only when their complete credential groups are present. Selecting an
unconfigured channel produces a terminal, observable delivery failure rather
than silently dropping the record.

All adapters implement the same channel/provider interface and return a provider
message identifier. Transport, rate-limit, and server failures are retryable;
ordinary validation/authentication failures are terminal. Sent Expo tickets
enter a receipt queue. Receipt reconciliation marks accepted tickets and treats
`DeviceNotRegistered` as terminal while atomically disabling the matching push
endpoint.

Resend receives Tempo's stable delivery idempotency key. Expo and Twilio remain
at-least-once dispatch boundaries because a process can fail after a provider
accepts the request but before the local transaction records success. Expo
status reconciliation is implemented. Twilio delivery-status webhooks and
provider-specific ambiguous-send reconciliation remain required before
high-volume rollout.

Resend and Twilio also implement a provider-neutral destination-verification
sender. Verification codes are random six-digit values, stored only as an
HMAC-derived hash, expire after ten minutes, and have bounded confirmation
attempts. Only verified email/SMS endpoints enter delivery scheduling.

Providers are vendor adapters rather than domain dependencies. Replacing Expo,
Resend, or Twilio requires a new adapter and deployment configuration; canonical
briefings, stored payload contracts, delivery state, and worker orchestration do
not change.

Operating instructions and sensitive-data constraints are in the
[briefing delivery runbook](./runbooks/briefing-delivery.md).

## Device calendar

The closed-beta calendar adapter is the Expo Calendar API on iOS. Permission is
requested in context after an authenticated user chooses Connect. The client
reads the next 48 hours and transforms events into time-only busy intervals
before crossing the network boundary.

The adapter never sends calendar names, event identifiers, titles, descriptions,
locations, attendees, or notes. The API accepts only an IANA timezone,
synchronization range, and busy start/end pairs. It merges overlaps before
storage and computes suggestions from those intervals.

This is intentionally not a Google or Microsoft account integration. A future
provider adapter must keep authorization tokens server-side, expose an explicit
disconnect/delete path, and normalize its output into the same free/busy-only
contract. Provider-specific private event content must not enter Tempo logs,
prompts, analytics, or persistence.

# Tempo iOS and web release status — 2026-07-25

## Release recommendation

**GO for continued shared web/API testing. Conditional GO for the next iOS test
build after a fresh current-main Simulator build and focused parity smoke. NO-GO
for a public production launch until custom-domain and real-provider acceptance
work is complete.**

Tempo's implemented iOS core journey, responsive web companion, API, hosted test
database, and one-shot runners received broad end-to-end coverage before the
client scope was narrowed to iOS and web. The server-side pool, TLS, delivery
error-shape, interaction error-surfacing, and confidence-presentation fixes are
merged on `main@0b52b33`.

The earlier iOS Simulator artifact passed the unchanged primary journey. It
predates the latest confidence and error-surfacing UI, so those deltas must be
runtime-verified in a fresh artifact before inviting iOS testers.

No production data, live provider delivery, or broad database reset was used.
All mutations were confined to Tempo's designated test environment and test
identity.

## Environment and artifacts

| Item               | Tested state                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| Repository         | `/Users/nathannoble/Desktop/tempo`                                           |
| Baseline           | `main@0b52b33b2f062adb34158d888f07ac858821848f`                              |
| Change branch      | `codex/ios-web-only`                                                         |
| iOS artifact       | EAS Simulator build `50353387-bf0a-4c7b-8f49-c295f8f171c1`                   |
| iOS runtime        | iPhone 16e Simulator, iOS 26.3                                               |
| Shared API         | `https://tempo-api-test.onrender.com`                                        |
| Shared web         | `https://tempo-web-test.onrender.com`                                        |
| Database           | Dedicated hosted Supabase test project through the Session pooler            |
| Database TLS       | Verified peer certificate with explicit provider CA and `verify-full`        |
| Secret environment | `.env.test`, Git-untracked, owner-only mode `0600`                           |
| Optional providers | Resend, Twilio, and live push credentials absent from the local test runtime |

## Automated and deployment verification

The last full merged-main gate before this scope change passed formatting,
linting, TypeScript, the web production build, and 70 tests. CI's Verify and
service-image jobs were green at merge time.

The iOS/web-only branch was then verified locally with:

- `pnpm check`: formatting, lint, TypeScript, web production build, 27 test
  files, and 73/73 tests passed;
- `expo install --check`: dependencies are up to date;
- Expo Doctor: 20/20 checks passed after explicitly aligning
  `@expo/metro-runtime` with Expo Router's required patch;
- a production-style iOS Expo export: bundle generation passed.

The shared test deployment was verified with:

- API health returning `200` and `{"status":"ok"}`;
- exact-origin CORS acceptance for the deployed web companion and rejection of
  an unrelated origin;
- hosted test smoke returning an onboarded account, two briefings, and 38
  grounded items;
- the deployed web origin rendering the sign-in surface;
- Render API, web, ingestion, intelligence, generation, and delivery services
  configured from `main`.

## iOS Simulator matrix

| Feature/case                        | Status                   | Evidence/observation                                                    |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| Install and launch                  | PASS                     | EAS Simulator build installed and launched                              |
| Empty sign-in validation            | PASS                     | Required-field feedback rendered                                        |
| Test login                          | PASS                     | Account gate routed to Today/onboarding correctly                       |
| Sign-out and sign-in again          | PASS                     | Auth screen restored and credentials accepted                           |
| Session restoration                 | PASS                     | Relaunch restored the signed-in route                                   |
| Account loading/retry UI            | PASS                     | Retry and sign-out controls rendered in a forced error state            |
| Onboarding duration/time            | PASS                     | Duration and local-time selections persisted                            |
| Suggested interest toggle           | PASS                     | Selected topic persisted                                                |
| Custom natural-language add/remove  | PASS                     | Added, removed, and re-added without duplicate state                    |
| Minimum-interest validation         | PASS                     | Advancement blocked with no interest selected                           |
| Depth and delivery controls         | PASS                     | Selections persisted                                                    |
| Onboarding submission               | PASS                     | API success and exact database correlation                              |
| Empty Today                         | PASS                     | Correct empty state before generation                                   |
| Ready Today and refresh             | PASS                     | Grounded 19-item briefing loaded                                        |
| Overview, duration, finite ending   | PASS                     | Explicit ending with no infinite feed                                   |
| Item expansion                      | PASS                     | Expanded content rendered                                               |
| Why it matters / what changed       | PASS                     | Both fields visible                                                     |
| Citation/source                     | PASS                     | Citation visible and external source opened                             |
| Useful / less like this / Save      | PASS                     | Interaction events reached the API                                      |
| Briefing detail deep link/back      | PASS                     | Owned canonical detail route and back navigation worked                 |
| Notification response route         | PASS via deep link       | Route exercised without claiming real push delivery                     |
| Quiet-hours update                  | PASS                     | Update succeeded through the API                                        |
| Endpoint channel rendering          | PASS                     | Delivery settings loaded configured channels                            |
| Offline/error/retry/reconnect       | PASS                     | Error state rendered and reconnect recovered                            |
| Dark mode                           | PASS                     | Legible palette across Today and expanded content                       |
| Accessibility large text            | PASS                     | Header, items, finite end, and sign-out remained reachable              |
| Keyboard behavior                   | PASS                     | Sign-in and onboarding inputs remained usable                           |
| Confidence presentation             | PENDING fresh artifact   | Merged code/test coverage exists; runtime parity still required         |
| Settings/interaction failure alerts | PENDING fresh artifact   | Merged code/test coverage exists; runtime parity still required         |
| Real push permission/token/delivery | N/A — simulator/provider | Requires a physical device and configured provider                      |
| Live email/SMS delivery             | N/A — provider           | Requires dedicated non-production provider credentials and destinations |
| Calendar permission/availability    | NOT IMPLEMENTED          | No current route, UI, or data model                                     |
| Post-onboarding interest management | NOT IMPLEMENTED          | Only onboarding controls exist                                          |
| Recommendation preference control   | NOT IMPLEMENTED          | Preference exists in data but has no client control                     |

## Web matrix

| Route                    | Implemented behavior                            | Status                                             |
| ------------------------ | ----------------------------------------------- | -------------------------------------------------- |
| `/sign-in`               | Supabase password sign-in and account creation  | Rendered live; authenticated click-through pending |
| `/`                      | Session/profile gate and latest briefing        | Production build and type/test gate PASS           |
| `/onboarding`            | Preferences, interests, depth, delivery default | Production build and type/test gate PASS           |
| `/briefings/:briefingId` | Canonical finite briefing and citations         | Production build and type/test gate PASS           |

The current web companion has no settings, post-onboarding interest management,
saved-items retrieval, feedback, delivery history, calendar, recommendation,
alert, archive, or search surfaces.

## API, database, and runner assertions

Previously verified runtime coverage includes:

- stable health, authentication, ownership, malformed-input, missing-resource,
  pagination, and idempotency error shapes;
- user preferences and interests, canonical briefings/items, grounded claims and
  citations, interactions, delivery endpoints/history, and cross-user isolation;
- migration history and repeated bootstrap idempotency;
- ingestion, intelligence, generation, and delivery one-shot runners;
- leases, retries, deterministic fixture replay, deduplication, time budgeting,
  immutable delivery snapshots, and provider-absent safety;
- a 30-minute Session-pool profile soak with 59/59 successful requests and no
  request over two seconds.

## Security and privacy

- `.env.test` remains Git-untracked and mode `0600`.
- Bootstrap logs emit aggregate results rather than identity or run UUIDs.
- Mobile/server evidence contains no passwords, bearer tokens, signed log URLs,
  database credentials, provider secrets, or full sensitive destinations.
- Expo's credential-removal flow created and displayed a local backup before
  deleting the retired native-platform credential; the backup was immediately
  destroyed and no credential material was added to the repository or report.
- Earlier focused process-log scans found no fatal or uncaught client events.
- Real provider acceptance must repeat exact-value secret scans after provider
  credentials are introduced.

## Credential-free iOS evidence

- [Launch](evidence/ios-launch.png)
- [Today](evidence/ios-today.png)
- [Expanded item](evidence/ios-item-expanded.png)
- [Citation/source](evidence/ios-citation-source.png)
- [Finite end](evidence/ios-finite-end.png)
- [Empty Today](evidence/ios-empty-today.png)
- [Offline error](evidence/ios-offline-error.png)
- [Dark mode](evidence/ios-dark-mode.png)
- [Accessibility large text](evidence/ios-accessibility-large.png)

## Remaining release actions

1. Build a fresh current-main iOS Simulator artifact and test Today/detail
   confidence, feedback/Save failure alerts, and Settings endpoint error/Retry.
2. Complete authenticated browser click-through on the deployed web companion.
3. Investigate the timing-dependent first-run bootstrap integration-test flake
   without weakening worker or idempotency assertions.
4. Put the public web service behind the intended custom domain, then update
   `CORS_ALLOWED_ORIGINS`, `BRIEFING_PUBLIC_BASE_URL`, and `NEXT_PUBLIC_API_URL`
   together.
5. Complete physical-device push and live Resend/Twilio acceptance testing with
   dedicated non-production destinations before public launch.

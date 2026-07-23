# Tempo full simulator QA — 2026-07-19 through 2026-07-22

## Release recommendation

**NO-GO for `main` as currently committed; conditional GO for the tested local
candidate after review, merge, and deployment smoke.**

Tempo's implemented iOS and Android core flows, live API, hosted test database,
and one-shot runners received broad end-to-end coverage. Both native platforms
now pass the implemented primary journey. Two release-blocking infrastructure
defects found during QA are resolved and regression-tested in the local working
tree:

1. Idle PostgreSQL client errors could terminate the API, and the five-second
   pool connection-acquisition timeout caused intermittent profile `500`s. The
   local handler plus a 15-second timeout passed the full gate and a 30-minute
   live soak: 59/59 profile requests returned `200`, with no request over two
   seconds.
2. A standalone Android preview could not reach the authorized local HTTP API
   because Android 9+ rejects cleartext by default. The local Expo configuration
   enables cleartext only for the internal `preview` profile. The signed
   corrected APK declares the flag, while default/production introspection does
   not. The corrected APK passed login, onboarding custom-interest add/remove,
   Today, expansion, feedback/save, settings, and the finite ending.

These changes are not committed to the real repository or deployed. Remaining P2
product issues include the generic provider-absent SMS `500`, silent endpoint
query/mutation failures, and omitted confidence presentation. They are
documented below rather than represented as passes.

No production data, deployment, provider delivery, or broad database reset was
performed. All mutations were confined to Tempo's designated test environment
and test identity.

## Status vocabulary

- **PASS** — exercised in this run and supported by recorded evidence.
- **FAIL** — exercised and an incorrect result was observed.
- **BLOCKED** — implemented behavior could not be exercised safely or with the
  required artifact/provider.
- **N/A — simulator/provider** — cannot be meaningfully completed on the test
  simulator or without an optional external provider.
- **NOT IMPLEMENTED** — requested product behavior has no current UI/API/data
  implementation. Source inspection is not counted as a runtime pass.

## Environment and artifacts

| Item                       | Tested state                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Repository                 | `/Users/nathannoble/Desktop/tempo`                                                                                            |
| Branch and baseline        | `main` at `af9fe26b2871273ccf32fb299d2d5d5268c6cb25`                                                                          |
| Working tree               | Baseline plus local pool safety/timeout, preview-only Android network config, focused tests, Prettier ignore, and QA evidence |
| iOS artifact               | EAS Simulator build `50353387-bf0a-4c7b-8f49-c295f8f171c1`                                                                    |
| iOS runtime                | iPhone 16e Simulator, iOS 26.3, UUID `4DA45B1D-0022-43AC-AAF7-9DC727BB42C0`                                                   |
| Baseline Android artifact  | Standalone EAS preview `47182eba-45ad-4465-b741-5e7048774932`; exact baseline commit; exposed cleartext-preview defect        |
| Corrected Android artifact | Standalone EAS preview `d44a3a25-b54b-40b6-b7f4-ade3dc8f874b`; isolated source snapshot equivalent to the tested local fixes  |
| Android runtime            | Android API 34 Google APIs ARM64, emulator `emulator-5554`, Nexus 5 AVD                                                       |
| Android JavaScript         | Embedded Hermes bundle in the corrected standalone APK; no Metro/development launcher required                                |
| API                        | Local Fastify service on loopback, kept live during device testing                                                            |
| Database                   | Hosted Supabase Session pooler and dedicated Tempo test data                                                                  |
| Database TLS               | `sslmode=verify-full`, explicit readable Supabase root CA, peer certificate verified, `DATABASE_SSL=true`                     |
| `.env.test`                | Present, Git-untracked, never copied into evidence; mode corrected from `0644` to `0600`                                      |
| Optional providers         | Resend, Twilio, and Expo provider credentials absent from this test environment                                               |

The four authorized public Expo variables contain only public mobile
configuration. No secret, password, bearer token, signed URL, full destination,
or environment value appears in this report.

## Traceable feature inventory

### Mobile routes and visible features

| Surface           | Implemented behavior                                                                                                           | Coverage location                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Root/session gate | Session restoration, profile loading, onboarding/app routing, account-load retry, sign-out                                     | iOS and Android matrices                                                             |
| Sign-in           | Email/password mode, empty-field validation, sign-up mode, email-confirmation state                                            | Sign-in tested; account creation intentionally blocked                               |
| Onboarding        | Duration, daily time, suggestions, natural-language custom interests, depth, push/email selection, minimum-interest validation | Full on iOS and corrected standalone Android                                         |
| Today             | Loading/error/retry/empty/ready, pull-to-refresh, finite briefing, overview and duration, automatic opened event               | Both platforms                                                                       |
| Briefing item     | Expand, why it matters, what changed, citations/source link, useful, less-like, save                                           | Both platforms                                                                       |
| Briefing detail   | Owned deep link/notification route, loading/error/back, canonical items and finite ending                                      | Both platforms; real notification N/A                                                |
| Delivery settings | Quiet hours, endpoint/channel rendering, email/SMS endpoint create/verify/disable                                              | Quiet hours/rendering on device; endpoints covered through API                       |
| Push registration | Permission, Android channel, Expo token upsert, response navigation                                                            | Real registration/delivery unavailable on iOS Simulator; route covered via deep link |
| Presentation      | Automatic light/dark theme, keyboard handling, accessibility labels/states, large text                                         | Both platforms                                                                       |

The current mobile app does not provide post-onboarding interest management,
saved-item retrieval or unsave, a defer button, calendar connection, alert-rule
management, recommendation settings, briefing shortening, source controls,
search, or the proposed five-tab navigation. Save and defer exist only as API
interaction event types; they are not durable saved/deferred domain models.

### Web routes

| Route                    | Implemented behavior                                                              | QA status                                                                        |
| ------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `/`                      | Session/profile gate and latest briefing                                          | Production build/type/test PASS; no separate browser E2E in this simulator scope |
| `/sign-in`               | Email/password sign-in and sign-up                                                | Production build/type/test PASS                                                  |
| `/onboarding`            | Duration, daily time, comma-separated instructions, depth, default email endpoint | Production build/type/test PASS                                                  |
| `/briefings/:briefingId` | Canonical finite briefing and citations                                           | Production build/type/test PASS                                                  |

There is no current web UI for settings, post-onboarding interests, saved items,
feedback, delivery history, calendar, recommendations, alerts, or search.

### API routes

| Method and path                                        | Purpose                  |
| ------------------------------------------------------ | ------------------------ |
| `GET /health`                                          | Health                   |
| `POST /v1/briefings/plan`                              | Pure briefing planning   |
| `GET /v1/users/me`                                     | Profile                  |
| `POST /v1/onboarding`                                  | Atomic onboarding        |
| `GET`, `PUT /v1/preferences`                           | Read/update preferences  |
| `GET`, `POST /v1/interests`                            | Paginated list/create    |
| `PATCH /v1/interests/:id`                              | Update or deactivate     |
| `GET /v1/briefings/today`                              | Latest eligible briefing |
| `GET /v1/briefings/:id`                                | Owned canonical briefing |
| `POST /v1/briefings/:id/items/:itemId/interactions`    | Idempotent interaction   |
| `GET`, `PUT /v1/delivery-endpoints`                    | List/upsert destinations |
| `DELETE /v1/delivery-endpoints/:id`                    | Disable destination      |
| `GET /v1/deliveries`                                   | Delivery history         |
| `POST /v1/delivery-endpoints/:id/verification`         | Request verification     |
| `POST /v1/delivery-endpoints/:id/verification/confirm` | Confirm verification     |

### Runners and database domain

Migrations `0001` through `0010` define users, preferences, interests, sources,
source items, clusters, cluster membership, claims, citations, candidate
updates, briefings/items, interactions, scheduled generation runs, delivery
endpoints, deliveries, and intelligence jobs. Ingestion, intelligence,
generation, and delivery are separate one-shot, leased, retryable runners.

Calendar connections/availability, alerts, notification-token persistence,
subscriptions, affiliate recommendations, a saved-item collection, and deferred
state are not currently modeled as dedicated database entities.

## Automated command outcomes

| Command/check                          | Status         | Recorded result                                                           |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| Initial `pnpm check`                   | FAIL, resolved | Prettier scanned Expo-generated `apps/mobile/expo-env.d.ts`               |
| `.prettierignore` update               | PASS           | Tooling-only exclusion; no product behavior changed                       |
| Focused pool regression                | PASS           | Safe idle-client handler plus 15-second acquisition timeout               |
| Preview config regressions             | PASS           | Cleartext enabled only when the internal preview profile opts in          |
| Final `pnpm check`                     | PASS           | Formatting, ESLint, TypeScript, Next production build, 28 files/70 tests  |
| Expo Doctor                            | PASS           | 20/20 checks                                                              |
| Expo dependency check                  | PASS           | SDK 57 dependencies aligned                                               |
| iOS Expo export                        | PASS           | Hermes iOS bundle exported                                                |
| Android Expo export                    | PASS           | Hermes Android bundle exported                                            |
| Baseline standalone Android EAS build  | PASS/defect    | Build `47182eba-45ad-4465-b741-5e7048774932`; local HTTP blocked natively |
| Corrected standalone Android EAS build | PASS           | Build `d44a3a25-b54b-40b6-b7f4-ade3dc8f874b`; installed and exercised     |
| Corrected signed-manifest inspection   | PASS           | Internet permission, `MainActivity`, preview cleartext flag present       |
| Default/production config inspection   | PASS           | Cleartext flag absent                                                     |
| Post-fix Session-pool soak             | PASS           | 30 minutes; 59/59 profile `200`; 1.11–1.90 s; zero over 5 s               |
| Test-environment bootstrap, first pass | PASS           | Migrations/fixtures valid; canonical briefing generated                   |
| Test-environment bootstrap, repeat     | PASS           | Generation claimed zero; no duplicate canonical artifacts                 |
| Test-environment smoke                 | PASS           | Onboarded test identity, one briefing, 19 grounded items                  |
| Guarded test reset                     | PASS           | Used three times, only with `TEST_ENV_CONFIRM_RESET=tempo-test-only`      |
| Git diff whitespace check              | PASS           | No whitespace errors after report formatting                              |

The supplied hosted-CI result at the baseline commit was green, but this report
does not substitute that claim for the local commands above.

## Live API matrix

The live local service, signed in through the test identity and backed by the
hosted test database, passed **52 of 52 planned contract cases**. A separate
intermittent profile failure was reproduced under soak and resolved locally as
described below.

| Area               | Positive and negative cases exercised                                    | Status                                                 |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| Health/plan        | Health; valid plan; malformed plan                                       | PASS                                                   |
| Authentication     | Access without a session to every protected group; stable error envelope | PASS                                                   |
| CORS               | Allowed configured origin; rejected other browser origin                 | PASS                                                   |
| Profile            | Signed-in profile creation/load; repeated and soak coverage              | PASS after local timeout fix                           |
| Onboarding         | First completion; identical idempotent replay; changed-payload conflict  | PASS                                                   |
| Preferences        | Read and validated update                                                | PASS                                                   |
| Interests          | Create, list, edit, deactivate, cursor pagination, malformed input       | PASS                                                   |
| Interest ownership | Other-user resource hidden as not found                                  | PASS                                                   |
| Briefings          | Today, owned detail, missing briefing/item                               | PASS                                                   |
| Briefing ownership | Other-user briefing/item hidden as not found                             | PASS                                                   |
| Interactions       | Every implemented event, idempotency replay, validation, ownership       | PASS                                                   |
| Delivery endpoints | List/upsert, validation, auto-verified email path, disable               | PASS                                                   |
| SMS verification   | Provider-absent request, incorrect code, confirm/ownership cases         | FAIL for provider-absent error shape; other cases PASS |
| Deliveries         | Owned list and validation                                                | PASS                                                   |

All planned malformed inputs and missing-resource/ownership cases returned
stable JSON error envelopes except the optional-provider case below. No API
response exposed another user's resource.

### Live API defects observed outside the 52-case pass set

- Android's first signed-in `GET /v1/users/me` sequence returned three generic
  `500` responses before Retry recovered. A controlled soak reproduced one
  failure at 5.006 seconds, matching the old five-second pool acquisition
  timeout. After increasing it to 15 seconds, a 30-minute soak completed 59/59
  requests with `200`; latency was 1.11–1.90 seconds.
- Requesting SMS verification with Twilio intentionally absent returned generic
  `500 INTERNAL_ERROR` and was logged as an unhandled API error. The service did
  not send externally, but the error should be a stable provider-unavailable
  response.

## Hosted database assertions

### Schema and integrity

| Assertion                  | Observed result                                                         | Status                      |
| -------------------------- | ----------------------------------------------------------------------- | --------------------------- |
| Migration history          | 10 migrations present through `0010`                                    | PASS                        |
| Foreign keys               | 28 declared; no invalid references found in tested data                 | PASS                        |
| Unique constraints/indexes | 24 declared; canonical and idempotency conflicts held                   | PASS                        |
| Check constraints          | 92 declared and validation cases held                                   | PASS                        |
| RLS                        | Enabled on 20 application tables                                        | PASS                        |
| Client policies            | Zero policies; clients are denied by default and the API owns DB access | PASS with architecture note |
| TLS                        | Socket authorized with peer certificate under explicit root CA          | PASS                        |

### Final deterministic test state

| Entity/assertion                     | Final observation                                                       | Status |
| ------------------------------------ | ----------------------------------------------------------------------- | ------ |
| Test users/preferences               | 1 / 1                                                                   | PASS   |
| Active interests                     | 2, one topic and one instruction, both deep                             | PASS   |
| Final fixture preferences            | 5 minutes, 00:00, no quiet window, in-app, calendar/recommendations off | PASS   |
| Sources/source items                 | 4 / 56                                                                  | PASS   |
| Intelligence jobs                    | 56 completed; no active lease                                           | PASS   |
| Clusters/claims/citations/candidates | 56 grounded aggregates; every cluster/candidate cited                   | PASS   |
| Scheduled run/briefing               | 1 / 1                                                                   | PASS   |
| Briefing items                       | 19, all grounded and within duration/word budget                        | PASS   |
| Delivery endpoints/deliveries        | 0 / 0 in final reset state                                              | PASS   |
| Canonical replay                     | Second bootstrap/generation/delivery claimed zero                       | PASS   |

The final fixture contains 19 items rather than the runbook's historical
one-item example because previously ingested global candidates remain in the
dedicated test database. Canonical idempotency, grounding, and budgets still
pass, but fixture size is no longer minimal or isolated from prior ingestion.

### UI/API-to-database correlation

| Action                       | Exact observed effect                                                                                                          | Status |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| iOS onboarding               | Completion timestamp, one preferences row, two active interests, expected depth/channels/quiet hours                           | PASS   |
| Suggested topic              | `Climate science` active                                                                                                       | PASS   |
| Natural-language instruction | `Track major AI releases` active                                                                                               | PASS   |
| Corrected Android onboarding | Standalone APK added, removed, re-added, and persisted the instruction plus `Climate science`, both deep                       | PASS   |
| Corrected Android settings   | Quiet-hours `PUT /v1/preferences` returned `200`; visible confirmation rendered after scrolling                                | PASS   |
| Today consumption/feedback   | 18 pre-reset interaction rows with opened, expanded, source-clicked, useful, not-useful, saved, deferred, and dismissed events | PASS   |
| Interaction replay           | Unique idempotency retained the original row                                                                                   | PASS   |
| Reset boundary               | Test identity/domain rows removed and deterministically restored; global source corpus preserved                               | PASS   |

Sensitive identity and destination values were omitted from all evidence.

## Runner and delivery matrix

| Runner/behavior                      | Runtime evidence                                                           | Status                                  |
| ------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------- |
| Ingestion lease and due-source claim | First pass claimed three official sources                                  | PASS                                    |
| Ingestion normalization              | Added 10 NASA, 20 Federal Reserve, and 25 Library of Congress items        | PASS                                    |
| Ingestion replay                     | Claimed zero due sources                                                   | PASS                                    |
| Intelligence recovery                | Reclaimed expired/failed jobs in bounded passes; final 56/56 complete      | PASS                                    |
| Intelligence replay                  | Claimed zero; no duplicate grounded aggregates                             | PASS                                    |
| Provenance                           | Claims/citations remained attached; no uncited candidate                   | PASS                                    |
| Generation                           | Created one local-day run and a 19-item budget-compliant briefing          | PASS                                    |
| Generation replay                    | Claimed zero; one canonical briefing retained                              | PASS                                    |
| Delivery                             | No eligible verified endpoint after final reset; safe zero-delivery result | PASS                                    |
| Delivery replay                      | Claimed zero and created zero receipts                                     | PASS                                    |
| Optional providers absent            | No real push/email/SMS sent                                                | PASS for safety; provider error UX FAIL |
| Leases                               | All ingestion/intelligence/generation/delivery leases released             | PASS                                    |
| Retry behavior                       | Expired intelligence work recovered without duplicate canonical artifacts  | PASS                                    |
| Immutable snapshots                  | Covered by the 70-test database/delivery gate                              | PASS                                    |

An earlier over-concurrent development-runner launch exhausted Session-pool
capacity and left 17 expired `processing` plus 12 failed intelligence jobs. A
normal isolated runner recovered all work. This demonstrates recovery, but also
shows that the local all-runner harness needs a connection-concurrency limit
appropriate for the Session pooler.

## iOS Simulator matrix

| Feature/case                               | Status                   | Evidence/observation                                                     |
| ------------------------------------------ | ------------------------ | ------------------------------------------------------------------------ |
| Build install and launch                   | PASS                     | EAS build installed and launched on iOS 26.3                             |
| Empty sign-in validation                   | PASS                     | Required-field feedback rendered                                         |
| Test login                                 | PASS                     | Routed through account gate to Today/onboarding as appropriate           |
| Sign-out and sign-in again                 | PASS                     | Auth screen restored and credentials accepted                            |
| Session restoration                        | PASS                     | Relaunch restored the signed-in route                                    |
| Account loading/retry UI                   | PASS                     | Retry and sign-out controls rendered in forced error state               |
| Onboarding duration/time                   | PASS                     | 10-minute and 12:00 selections persisted                                 |
| Suggested interest toggle                  | PASS                     | Selected topic persisted                                                 |
| Custom natural-language add/remove         | PASS                     | Added, removed, and re-added without duplicate UI state                  |
| Minimum-interest validation                | PASS                     | Advancement blocked with no interest selected                            |
| Depth                                      | PASS                     | Deep selection persisted for created interests                           |
| Push/email onboarding toggles              | PASS                     | Controls toggled; selected channels persisted                            |
| Onboarding submission                      | PASS                     | API success and exact DB correlation                                     |
| Empty Today                                | PASS                     | Correct empty state after onboarding before generation                   |
| Ready Today/pull-to-refresh                | PASS                     | Restored briefing showed 19 items                                        |
| Overview/duration/finite ending            | PASS                     | Briefing ended explicitly; no infinite feed                              |
| Item expansion                             | PASS                     | Expanded content rendered                                                |
| Why it matters / what changed              | PASS                     | Both fields visible                                                      |
| Confidence                                 | FAIL                     | Contract/data supports confidence, but mobile item UI does not render it |
| Citation/source                            | PASS                     | Citation visible; opened Example Domain in Safari                        |
| Useful / less like this                    | PASS                     | Controls recorded interaction events                                     |
| Save                                       | PASS                     | Save event recorded                                                      |
| Unsave / saved-items view                  | NOT IMPLEMENTED          | No durable UI/model                                                      |
| Defer control                              | NOT IMPLEMENTED          | API event type exists; no mobile control/state model                     |
| Briefing detail deep link                  | PASS                     | System confirmation opened owned canonical detail; back gesture worked   |
| Notification response navigation           | PASS via deep link       | Route behavior exercised without claiming a real push                    |
| Quiet-hours update                         | PASS                     | 21:00–06:00 save succeeded through API                                   |
| Endpoint channel rendering                 | PASS                     | Delivery settings loaded channels                                        |
| Offline/error/retry/reconnect              | PASS                     | Profile error rendered; automatic reconnect recovered                    |
| Dark mode                                  | PASS                     | Legible dark palette across Today/item                                   |
| Accessibility large text                   | PASS                     | Header, item, finite end, and sign-out remained reachable                |
| Keyboard behavior                          | PASS                     | Sign-in and onboarding inputs remained usable                            |
| Loading state                              | BLOCKED                  | Transient spinner was not independently captured/asserted                |
| Sign-up/new Auth user                      | BLOCKED                  | Avoided creating an extra hosted test identity                           |
| Real push permission/token/delivery        | N/A — simulator/provider | `Device.isDevice` guard; no real device/provider credential              |
| Email/SMS real delivery                    | N/A — simulator/provider | Optional provider secrets absent; API safety path tested                 |
| Calendar permission/availability           | NOT IMPLEMENTED          | No route/UI/data model                                                   |
| Interest edit/mute/delete after onboarding | NOT IMPLEMENTED          | Only onboarding controls exist                                           |
| Recommendation toggle                      | NOT IMPLEMENTED          | Preference exists in data but no mobile settings control                 |

## Android emulator matrix

The initial development APK covered the broad matrix. Native parity was then
repeated with two standalone APKs. Exact-baseline build
`47182eba-45ad-4465-b741-5e7048774932` exposed Android's default cleartext
block. Corrected build `d44a3a25-b54b-40b6-b7f4-ade3dc8f874b` contains an
embedded Hermes bundle, resolves to `MainActivity`, and has no development
launcher.

| Feature/case                    | Status                | Evidence/observation                                                       |
| ------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| Emulator/tooling/install        | PASS                  | API 34 ARM64 AVD; corrected signed APK installed                           |
| Fresh baseline standalone APK   | FAIL                  | Built and launched, but native policy blocked the preview's local HTTP API |
| Preview-only native network fix | PASS                  | Signed manifest has cleartext flag; default/production config does not     |
| Corrected standalone APK        | PASS                  | Build installed, launched, and used the embedded bundle without Metro      |
| Empty sign-in validation        | PASS                  | Required-field feedback and deterministic form scrolling worked            |
| Test login/profile              | PASS                  | Corrected APK reached ready Today; API profile and briefing calls `200`    |
| Session restoration             | PASS                  | Relaunch restored the signed-in route                                      |
| Sign-out                        | PASS                  | Returned to auth screen in the broad matrix                                |
| Onboarding duration/time        | PASS                  | Controls rendered and submitted                                            |
| Suggested interests             | PASS                  | `Climate science` selected and persisted                                   |
| Minimum-interest validation     | PASS                  | Empty selection blocked completion in the broad matrix                     |
| Depth/delivery controls         | PASS                  | Deep selection and delivery controls rendered                              |
| Custom instruction add/remove   | PASS                  | Added, removed, re-added, and persisted without a dev overlay              |
| Empty Today                     | PASS                  | Correct post-onboarding empty state                                        |
| Ready Today/pull-to-refresh     | PASS                  | 19-item briefing loaded and refreshed                                      |
| Finite ending                   | PASS                  | Corrected standalone APK reached explicit ending                           |
| Item expansion                  | PASS                  | Expanded content rendered                                                  |
| Why it matters / what changed   | PASS                  | Both fields visible                                                        |
| Confidence                      | FAIL                  | Not rendered by mobile item UI                                             |
| Citation/source                 | PASS                  | External source opened in Chrome in the broad matrix                       |
| Useful / less like this / save  | PASS                  | Corrected APK recorded all three actions                                   |
| Briefing detail deep link/back  | PASS                  | Owned detail route and navigation worked in the broad matrix               |
| Quiet-hours update              | PASS                  | Corrected APK received API `200` and rendered “Quiet hours saved.”         |
| Endpoint channel rendering      | PASS                  | Email/SMS destination controls rendered                                    |
| Offline/error/reconnect         | PASS                  | Error state and recovery passed in the broad matrix                        |
| Dark mode                       | PASS                  | Legible dark palette in the broad matrix                                   |
| Large font                      | PASS                  | At 1.5 font scale, the finite end remained reachable                       |
| Keyboard/form scrolling         | PASS                  | Corrected sign-in and onboarding inputs remained usable                    |
| Real push/email/SMS/calendar    | N/A / NOT IMPLEMENTED | Same provider and implementation limits as iOS                             |

Expo's official build-properties documentation confirms that Android 9+ defaults
cleartext traffic to false. The local fix opts in only for internal preview
builds: <https://docs.expo.dev/versions/latest/sdk/build-properties/>.

## Log and privacy review

- Android fatal/React-crash logcat scan found zero matching fatal, crash, or
  React warning events during the recorded flows.
- A targeted iOS scan for `RCTFatal`, fatal/uncaught exceptions, application
  termination, and React warnings found zero matches. A broad platform `error`
  query was discarded as non-actionable network-framework noise.
- The API stayed alive after the local pool fix. A later idle-client
  `EADDRNOTAVAIL` was sanitized to event/code, and the post-timeout 30-minute
  soak had no `500`.
- API logs retained the original transient profile failures and the SMS
  provider-absent generic error as defect evidence. No signed URLs or tokens are
  reproduced here.
- Bootstrap output originally included the test identity and run UUIDs. The
  local fix now emits only aggregate counts/statuses; the focused integration
  test and hosted idempotent replay confirm the sanitized shape.
- `.env.test` was Git-untracked but mode `0644`; this run corrected it to
  owner-only (`0600`) and verified the resulting mode.
- Fetched content is treated as external data in the ingestion path, but this QA
  did not conduct a dedicated malicious-content/prompt-injection campaign.

## Defects and gaps

| ID     | Severity               | Platform/layer                                    | Reproduction                                                                      | Expected                                           | Actual / suspected cause                                                                                                  | Coverage impact                           |
| ------ | ---------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| QA-001 | P1 resolved locally    | API/database                                      | Run local API against Session pooler long enough for an idle client network error | Pool errors are handled and service stays live     | Unhandled `pg.Pool` error terminated process; local handler/test and live idle-error retest pass                          | Merge/deployment still required           |
| QA-002 | P1 QA blocker resolved | Android build                                     | Attempt current-commit native parity test                                         | Fresh standalone preview APK                       | Baseline and corrected standalone APKs built; corrected APK completed blocker matrix                                      | Coverage blocker removed                  |
| QA-003 | P2 resolved locally    | Android/API/database                              | Repeated profile loads after idle pool release                                    | Profile loads without intermittent `500`           | Five-second acquisition timeout reproduced failure; 15-second setting passed 59/59 live soak                              | Merge/deployment still required           |
| QA-004 | P2                     | API/delivery                                      | Request SMS verification with Twilio absent                                       | Stable provider-unavailable response               | Generic `500 INTERNAL_ERROR`, logged as unhandled                                                                         | Negative delivery UX fails                |
| QA-005 | P2                     | Mobile/settings                                   | Make endpoint-list query fail                                                     | Visible error/retry                                | Source inspection shows endpoint query errors are not rendered                                                            | Failure state unverified/invisible        |
| QA-006 | P2                     | Mobile/interactions                               | Force an interaction mutation failure                                             | Rollback or visible failure                        | UI is optimistic and does not surface mutation errors                                                                     | Users may believe feedback/save succeeded |
| QA-007 | P2 resolved locally    | Bootstrap/logging                                 | Run test bootstrap                                                                | Aggregate status without identity/run UUIDs        | Local output now contains only event, counts, and outcome statuses; regression and hosted replay pass                     | Merge required                            |
| QA-008 | P2 resolved            | Local environment                                 | Inspect `.env.test` mode                                                          | Owner-only secret file                             | Mode began at `0644`; corrected and verified as `0600`                                                                    | Resolved locally                          |
| QA-009 | P2 test infrastructure | Start runners concurrently against Session pooler | Connection use stays within pool capacity                                         | Jobs failed/expired until isolated recovery        | Can make full-stack test run flaky                                                                                        |
| QA-010 | P2 test determinism    | Bootstrap after live ingestion                    | Documented minimal deterministic fixture                                          | 19 global candidates selected                      | Fixture depends on retained ingestion corpus, though canonical replay is stable                                           |
| QA-011 | P2 product             | Expand a briefing item                            | Confidence visible with required item fields                                      | No confidence presentation on either platform      | Implemented data is omitted from UI                                                                                       |
| QA-012 | P3 resolved            | Tooling                                           | Run Prettier gate after Expo generation                                           | Generated declaration excluded                     | Gate initially failed; `.prettierignore` fix passes                                                                       | None after local fix                      |
| QA-013 | P1 resolved locally    | Android preview/native networking                 | Sign in using a standalone preview with local HTTP API                            | Internal preview reaches API through `adb reverse` | Baseline APK was blocked by Android cleartext default; preview-only native flag fixed it, production remains default-deny | Merge and rebuild from repository commit  |

### Important implementation gaps, not runtime failures

- Post-onboarding interest add/edit/mute/delete and natural-language rule
  management.
- Durable saved-items/unsave and defer-to-next-briefing state.
- Calendar connection, availability, and permission UX.
- Alert rules and alert history.
- Recommendation preference control and labeled recommendation presentation.
- Briefing shortening, simpler/deeper explanation controls, source controls,
  search, history/archive, and proposed primary tabs.
- Real-device push token/delivery and live email/SMS delivery in this
  provider-free environment.

## Screenshot evidence

Credential-free evidence is stored under `docs/qa/evidence/`:

### iOS

- [Today](evidence/ios-today.png)
- [Expanded item](evidence/ios-item-expanded.png)
- [Citation/source](evidence/ios-citation-source.png)
- [Finite end](evidence/ios-finite-end.png)
- [Empty Today](evidence/ios-empty-today.png)
- [Offline error](evidence/ios-offline-error.png)
- [Dark mode](evidence/ios-dark-mode.png)
- [Accessibility large text](evidence/ios-accessibility-large.png)
- [Launch](evidence/ios-launch.png)

### Android

- [Corrected standalone Today](evidence/android-release-today.png)
- [Corrected standalone expanded item](evidence/android-release-expanded.png)
- [Corrected standalone finite end](evidence/android-release-finite-end.png)
- [Corrected standalone settings](evidence/android-release-settings.png)
- [Corrected standalone custom interest](evidence/android-release-custom-interest.png)
- [Corrected standalone empty Today](evidence/android-release-empty-today.png)
- [Today](evidence/android-today.png)
- [Expanded item](evidence/android-item-expanded.png)
- [Citation/source](evidence/android-citation-source.png)
- [Finite end](evidence/android-finite-end.png)
- [Empty Today](evidence/android-empty-today.png)
- [Offline error](evidence/android-offline-error.png)
- [Dark mode](evidence/android-dark-mode.png)
- [Large text](evidence/android-large-text.png)

## Remaining release actions

1. Review and commit the local pool handler/timeout and preview-only Android
   configuration with their tests. Run `pnpm check` on the repository commit.
2. Deploy the API change to the intended non-production/release environment and
   repeat health, ten profile loads, and an idle/reconnect smoke. The 30-minute
   local hosted-pool soak already passes.
3. Build one Android preview from the actual merged repository commit and repeat
   the short traceability smoke: install/launch, login, Today, expansion,
   feedback/save, settings, and custom-interest onboarding. Corrected build
   `d44a3a25-b54b-40b6-b7f4-ade3dc8f874b` already proves the source change.
4. Normalize absent-provider errors and render endpoint/mutation failures.
5. Keep `.env.test` at `0600`. Real-device push and live email/SMS remain
   provider acceptance tests rather than simulator blockers.

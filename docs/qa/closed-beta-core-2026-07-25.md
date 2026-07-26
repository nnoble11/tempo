# Tempo closed-beta core verification — 2026-07-25

## Outcome

**The five closed-beta features are implemented for iOS and web and are ready
for a preview build. Public or broad beta release remains conditional on a
physical-iPhone push/calendar acceptance pass.**

The implementation, API, migration, dedicated test database, live local web
experience, production web build, iOS export, and fresh iOS Simulator native
build were exercised. Real APNs delivery and a real device's Calendar permission
sheet cannot be accepted in the Simulator and are explicitly not claimed as
passed.

No production data was used. Test mutations were limited to Tempo's designated
test identity and dedicated hosted test database. The temporary interest created
for the live lifecycle test was soft-deleted after verification.

## Environment

| Item               | Verified state                                                     |
| ------------------ | ------------------------------------------------------------------ |
| Repository         | `/Users/nathannoble/Desktop/tempo`                                 |
| Baseline           | `f077228b54a3d0b48dd7dd06c2a6d730f668ec39`                         |
| Branch             | `codex/closed-beta-core`                                           |
| Scope              | iOS and web; no first-party Android implementation                 |
| Database           | Dedicated hosted Supabase test project through the Session pooler  |
| Database TLS       | Peer verification enabled with the configured provider CA          |
| iOS runtime        | iPhone 17 Pro Simulator, iOS 26.3                                  |
| Apple toolchain    | Xcode 26.3, Swift 6.2.4                                            |
| Expo               | SDK 57                                                             |
| Optional providers | Real APNs, Resend, and Twilio acceptance credentials were not used |

## Feature matrix

| Feature                             | iOS                                                                                                                   | Web                                                                  | API/database                                                                                     | Result                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Post-onboarding interest management | Topic, entity, and natural-language add/edit/mute/reactivate/delete screens implemented                               | Live add/edit/mute/reactivate/delete lifecycle exercised             | Ownership, validation, active filter, and soft deletion covered by integration tests             | **PASS**, subject to final physical-device visual smoke                               |
| Reliable scheduled mobile push      | Settings for local time, timezone, enablement, and quiet hours; launch/foreground token refresh; UUID-only deep links | Not applicable                                                       | Existing scheduling/delivery pipeline retained; registration and deep-link pure tests pass       | **CONDITIONAL**: logic passes; real APNs token and delivery require a physical iPhone |
| Durable Saved and Later             | Dedicated Saved/Later views and durable toggle state                                                                  | Live Save and Later persistence and both collection routes exercised | `briefing_item_states`, pagination, ownership, and concurrent first-write regression covered     | **PASS**                                                                              |
| Briefing history/archive            | Paginated History view and canonical briefing navigation                                                              | Live three-briefing history list exercised                           | Owned paginated history endpoint and repository coverage pass                                    | **PASS**                                                                              |
| Calendar availability               | Native Calendar integration reads a 48-hour horizon and sends only busy timestamps; module compiled and linked        | Live no-connection/privacy state exercised                           | Connection, busy-window sync, suggestion, and disconnect routes plus merge/suggestion tests pass | **CONDITIONAL**: server/web pass; native permission/sync requires a physical iPhone   |

## Automated verification

| Command/check                   | Outcome                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm check`                    | PASS: formatting, lint, TypeScript, production web build, 32 test files, 91/91 tests |
| Production web build            | PASS: 10 routes, including Interests, Saved, Later, History, and Calendar            |
| `expo install --check`          | PASS: dependencies aligned                                                           |
| Expo Doctor                     | PASS: 20/20 checks                                                                   |
| iOS Expo export                 | PASS: 1,400 modules and Hermes bundle generated                                      |
| `pnpm test:env:bootstrap` twice | PASS: migrations/fixtures idempotent with no duplicate canonical artifacts           |
| `pnpm test:env:smoke`           | PASS: onboarded test user, 3 briefings, 57 grounded items                            |
| Fresh `expo run:ios`            | PASS: build, link, install, Metro HTTP 200, and native Tempo welcome render          |

The fresh native build exposed an Expo SDK 57/Xcode 26.3 compiler
incompatibility in `expo-modules-jsi@57.0.4`: Swift 6.2.4 could not resolve the
global `abs` overload for a `Double`. A one-line pnpm patch uses
`milliseconds.magnitude`, is hash-pinned in `pnpm-lock.yaml`, and was verified
by a second clean dependency relink and successful native build.

## Live web evidence

- Authenticated Today loaded the canonical finite 19-item briefing, citations,
  confidence, and explicit end state.
- A temporary entity was added, renamed, described, assigned importance/depth,
  muted, reactivated, and then soft-deleted.
- Save and Later were triggered in rapid succession, persisted together, and
  appeared in both dedicated collections.
- History returned three prior briefings.
- Calendar displayed the expected disconnected state and explicit busy-time-only
  privacy copy.
- The collection loading states no longer flash a false empty result before the
  first request completes.

## API and database assertions

- Interest payloads accept editable names/descriptions and reject malformed or
  unauthorized updates.
- Interest deletion is a user-owned soft delete; historical briefing evidence is
  preserved.
- Saved and deferred state is durable and separate from append-only behavioral
  interactions.
- A briefing-item row lock serializes concurrent first writes, preventing Save
  and Later from clobbering each other.
- Saved/Later and history endpoints are owned and cursor-paginated.
- Calendar storage contains provider metadata and busy time boundaries only.
  Event titles, locations, attendees, descriptions, and notes are not accepted
  by the contract or stored by the migration.
- Calendar suggestions are derived from merged busy windows and the user's
  duration preference.
- Migration `0011_closed_beta_core.sql` applies RLS/ownership constraints and
  required indexes/uniqueness rules.

## Defects found and resolved

| Severity               | Defect                                                                                           | Resolution and retest                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| High                   | Simultaneous first Save and Later writes could each observe no state row and overwrite one flag  | Locked the owned briefing-item row before state creation; concurrent integration regression and live DB retest pass |
| Medium                 | Saved/Later/History could briefly render a false empty state while the first request was loading | Added explicit loading states; production build and live route retest pass                                          |
| Medium, infrastructure | Expo JSI failed to compile under Xcode 26.3/Swift 6.2.4 because `abs(Double)` was ambiguous      | Added a one-line hash-pinned pnpm patch; two native builds completed, with the final build using the tracked patch  |

## Security and privacy observations

- `.env.test` remained untracked and no credential values were printed, copied
  into evidence, or included in this report.
- Database TLS verification was not disabled.
- Notification navigation accepts Tempo-owned UUID targets rather than arbitrary
  URLs.
- Calendar upload is intentionally lossy: only start/end busy boundaries leave
  the device.
- No production data, broad reset, live SMS/email destination, or live APNs
  delivery was used.

## Remaining physical-iPhone acceptance

These are the only required user-assisted actions before calling the two
conditional rows fully passed:

1. Create/install a current iOS preview or development build on a physical
   iPhone.
2. Sign in with Tempo's designated test account and allow notifications.
3. Enable daily push, set a delivery time a few minutes ahead, confirm the
   timezone and quiet-hours values, then run the normal generation/delivery
   cycle.
4. Confirm exactly one notification arrives, opens the intended Tempo briefing,
   and does not navigate to an arbitrary external URL.
5. Open Calendar, allow access, create a harmless test event in the next 48
   hours, sync, and confirm Tempo shows a fitting free-window suggestion.
6. Revoke Calendar access and disconnect Tempo; confirm suggestions stop and the
   connection/busy-window records are removed.

Use the exact provider/build commands and database checks in
[`docs/runbooks/briefing-delivery.md`](../runbooks/briefing-delivery.md). Do not
add real credentials to the repository or screenshots.

## Release recommendation

**GO for a controlled iOS/web preview build. CONDITIONAL GO for a closed beta
after the six-step physical-iPhone acceptance above. NO-GO for a public launch
until real push/calendar acceptance and the separately planned provider-backed
email/SMS work are complete.**

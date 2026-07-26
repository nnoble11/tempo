# Mobile Today Experience

Status: Authenticated onboarding, delivery control, and consumption path  
Last updated: 2026-07-25

## Purpose

The Expo application implements Tempo's primary daily habit: consume one finite,
time-budgeted, citation-grounded briefing and then be done.

The Today screen supports:

- explicit loading, error, empty, and ready states;
- pull to refresh;
- total and item-level time estimates;
- an overview and ordered briefing items;
- item expansion for “why it matters” and “what changed”;
- claim-level source links with duplicate citations collapsed for display;
- useful, less useful, save, expand, open, and source-click interactions;
- a clear end state instead of infinite scrolling;
- light and dark color schemes.
- notification opens routed directly to the owned canonical briefing detail;
- a delivery-settings route for quiet hours, email/SMS addition, verification,
  and endpoint disablement.

Before Today, Expo Router protects the application routes and presents:

- password sign-in and account creation through Supabase Auth;
- email-confirmation guidance when the project requires confirmation;
- a finite onboarding form for duration, local daily time, timezone, initial
  interests, depth, and delivery-channel selection;
- atomic onboarding completion before entering the application.

## API boundary

Set `EXPO_PUBLIC_API_URL` to the product API origin and configure
`EXPO_PUBLIC_SUPABASE_URL` plus `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
authentication. These are public project identifiers, not service-role
credentials.

Supabase owns access/refresh session exchange. Native session data is persisted
through Expo SecureStore with device-only keychain accessibility; web uses
browser local storage. Refresh starts while the native app is active and stops
in the background. API requests resolve the current access token from the
Supabase session. No access token or service secret is accepted from an
`EXPO_PUBLIC_*` variable.

Every account, Today, onboarding, endpoint, and interaction response is
validated with shared contracts. TanStack Query keys profile data by
authenticated user so signing out cannot expose another account's cached
profile.

## Push registration

Set `EXPO_PUBLIC_EAS_PROJECT_ID` for physical-device push registration. After
onboarding, the app registers only when the user selected push:

1. request iOS notification permission;
2. obtain the EAS project-scoped Expo push token;
3. upsert the token through the authenticated delivery-endpoint API.

Simulators, web, missing project configuration, and denied permission exit
without registering an endpoint. Push registration is best-effort and does not
block access to the canonical in-app briefing.

The app handles both the last notification response and live response events. It
reads only the validated briefing UUID and navigates to
`/briefings/[briefingId]`; the API still enforces ownership.

The delivery runner reconciles Expo receipts separately. A `DeviceNotRegistered`
receipt disables the exact endpoint so future briefings do not keep targeting an
invalid token.

## Test distribution

`apps/mobile/eas.json` provides:

- `development`: internal development client;
- `preview`: installable internal iOS build;
- `ios-simulator`: preview build for the simulator;
- `production`: auto-incremented store build.

The development profile includes `expo-dev-client`. Real EAS builds still
require the project ID, Expo login, and platform signing credentials. Test
backend variables should be stored in the EAS `preview` environment rather than
committed to the repository.

## Query behavior

TanStack Query owns server state. App foreground transitions restore focus, the
Today query refreshes on focus, and successful feedback invalidates the
canonical briefing query. Component state is limited to item expansion and
immediate feedback presentation. Local onboarding draft state is discarded after
the atomic API mutation completes.

## Validation

Use:

```bash
pnpm --filter @tempo/mobile exec expo install --check
pnpm --filter @tempo/mobile exec expo export --platform ios \
  --output-dir /tmp/tempo-mobile-ios-export
```

The shared repository gate also compiles and tests the mobile TypeScript:

```bash
pnpm check
```

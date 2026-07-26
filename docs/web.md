# Web Companion

Status: Closed-beta companion management and canonical reading path Last
updated: 2026-07-25

## Purpose

The Next.js App Router application is a responsive companion to Tempo's mobile
habit. It does not introduce a second feed or regenerate content. It reads the
same finite canonical briefing and provides the public route shape used by email
and SMS links.

Implemented routes:

- `/sign-in`: Supabase email/password sign-in and account creation;
- `/onboarding`: time budget, daily schedule, initial interests, and depth;
- `/`: protected Today briefing;
- `/briefings/[briefingId]`: protected canonical briefing detail;
- `/interests`: add, edit, mute, reactivate, and delete interests;
- `/saved`: durable Saved collection;
- `/later`: durable deferred-item collection;
- `/history`: canonical briefing archive;
- `/calendar`: view suggestions and delete synchronized free/busy state.

Every factual item displays the stored takeaway, why-it-matters text, what
changed, reading estimate, and claim-level source links. The end of the briefing
is explicit. Save and Later actions update the same API state as iOS and emit
behavioral signals when enabled.

Device calendar permission and synchronization remain iOS-only. Web receives
only derived time-only availability through the authenticated API. It never
receives event details or provider credentials and can disconnect and delete the
synchronized state.

## Authentication and API boundary

The browser uses only the Supabase project URL and publishable key. It resolves
the active bearer token and calls Tempo's API through `NEXT_PUBLIC_API_URL`. The
API remains responsible for ownership and contract validation; route parameters
never select a user.

Because browser requests may cross origins, the API requires the exact deployed
web origin in `CORS_ALLOWED_ORIGINS`. Wildcard production CORS is intentionally
unsupported.

Web onboarding registers the authenticated identity email as an endpoint after
the atomic onboarding transaction. The API verifies it only when it exactly
matches the token's email.

## Configuration

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

All three are public runtime identifiers. Database, Supabase service-role,
email, SMS, and verification secrets remain server-side.

## Validation

```bash
pnpm --filter @tempo/web build
pnpm dev:web
```

The root `pnpm build` and `pnpm check` gates include the web production build
and TypeScript validation.

# Test Environment Runbook

## Purpose

Tempo's test environment commands create a repeatable, citation-grounded product
state without relying on third-party news availability. The fixture includes one
test identity, one active interest, one normalized source item, one processed
story, and one finite canonical briefing.

Never point these commands at production. Use a dedicated PostgreSQL database
and Supabase project.

## Configure

Copy `.env.test.example` into your secret/environment manager and replace every
placeholder. The Supabase URL, service-role key, and test-user password must be
provided together. The service-role key belongs only on the server-side
bootstrap command; never expose it through `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.
The root `test:env:*` commands load `.env.test` automatically.

For a local database-only bootstrap, omit all three Supabase test-auth values.
The fixed `TEST_USER_ID` will be used directly, which validates the pipeline but
does not create a login credential for the clients.

## Bootstrap and start

Apply migrations and create the deterministic fixture:

```bash
pnpm test:env:bootstrap
```

The command is idempotent. A repeated invocation keeps the same account and
daily briefing rather than producing duplicates.

Start the API, responsive web app, Expo development server, intelligence cycle,
and briefing-generation cycle:

```bash
pnpm test:env:start
```

The orchestration script skips a worker tick if the previous cycle has not
finished. It exits the group if a child process fails and forwards termination
signals to the children.

When the API is running, verify health and grounded fixture state:

```bash
pnpm test:env:smoke
```

## Reset

Reset is deliberately guarded:

```bash
TEST_ENV_CONFIRM_RESET=tempo-test-only pnpm test:env:reset
```

The reset snapshots fixture interest/cluster IDs, removes the test user's
canonical artifacts in foreign-key-safe order, removes the fixture source
aggregate, and deletes only interests no remaining user follows. It does not
delete the Supabase Auth identity, so the same test login can be bootstrapped
again.

## Shared test-environment checklist

- API CORS allowlist contains the exact test web origin.
- Web and mobile public variables target only the test Supabase/API projects.
- The mobile build uses an EAS `preview` environment and internal distribution.
- Resend/Twilio test credentials and destinations are non-production.
- The API, intelligence, generation, and delivery one-shot runners have
  recurring schedules.
- Logs and analytics exclude delivery destinations, verification codes, calendar
  details, and bearer tokens.
- `pnpm check`, both Expo exports, `pnpm test:env:bootstrap`, and
  `pnpm test:env:smoke` pass before inviting testers.

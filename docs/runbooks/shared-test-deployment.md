# Shared Test Deployment Runbook

## Purpose

This runbook promotes the locally proven Tempo test environment into a shared,
non-production environment. It keeps the canonical briefing in PostgreSQL, keeps
all runners idempotent and one-shot, and keeps client-public values separate
from server secrets.

Do not reuse production credentials or production destinations in this
environment.

## Deployment shape

Build `infrastructure/docker/Dockerfile` once and reuse the resulting image for
the API and every scheduled runner. The image defaults to the API command.
Override the command for scheduled jobs using
`infrastructure/deployment/service-plan.yaml`.

The deployment has these processes:

| Process      | Command                   | Cadence                            |
| ------------ | ------------------------- | ---------------------------------- |
| API          | `pnpm start:api`          | Continuous; health check `/health` |
| Migrations   | `pnpm migrate:production` | Once before each release           |
| Ingestion    | `pnpm start:ingestion`    | Every 15 minutes                   |
| Intelligence | `pnpm start:intelligence` | Every minute                       |
| Generation   | `pnpm start:generation`   | Every minute                       |
| Delivery     | `pnpm start:delivery`     | Every minute                       |

Overlapping invocations are safe because PostgreSQL leases and idempotency keys
coordinate work. The scheduler should still avoid starting a second copy when a
prior invocation is visibly running.

## Render Blueprint

The repository root contains `render.yaml`. It creates the API and four
scheduled runners from the shared Dockerfile, runs migrations before API
releases, waits for GitHub checks before automatic deploys, and keeps preview
environments off to avoid accidental test infrastructure.

Before creating the Blueprint, connect Render's GitHub App to `nnoble11/tempo`.
In Render, open **Account Settings**, scroll to **Account Security**, and add a
GitHub credential under **Git Deployment Credentials**. If the account is
already connected but Tempo is missing, configure the Render GitHub App at
<https://github.com/apps/render/installations/new> and include the `tempo`
repository under **Repository access**.

Then choose **New > Blueprint**, select `nnoble11/tempo`, and keep the Blueprint
path as `render.yaml`. Render prompts for only:

- `DATABASE_URL`: the Supabase **Session pooler** connection string on port
  `5432`, with the real database password substituted. Do not use the existing
  local `.env.test` URL or Supabase's IPv6-only direct URL. Render cannot reach
  either one.
- `SUPABASE_URL`: the same test project URL used by the clients.

Render generates `DELIVERY_VERIFICATION_SECRET`. The runners reference the API's
database value, so the database credential is entered only once. Review the
estimated paid resources before applying the Blueprint; cron jobs do not support
Render's free instance type.

The initial Blueprint intentionally uses `https://tempo.invalid` as a closed
placeholder for browser CORS and briefing links. After the web service has a
final HTTPS origin, replace `CORS_ALLOWED_ORIGINS` on `tempo-api-test` and
`BRIEFING_PUBLIC_BASE_URL` on `tempo-generation-test`, then redeploy both.

## Server environment

Set these on the API:

- `DATABASE_URL`: dedicated test PostgreSQL connection string.
- `DATABASE_SSL=true` when the provider requires TLS.
- `SUPABASE_URL`: dedicated test Supabase project URL.
- `SUPABASE_JWT_AUDIENCE=authenticated`.
- `HOST=0.0.0.0`.
- `PORT`: value supplied by the host, normally `3001` in the image.
- `MIGRATE_ON_START=false`; use the release command instead.
- `DELIVERY_VERIFICATION_SECRET`: at least 32 random characters.
- `CORS_ALLOWED_ORIGINS`: exact deployed web origin, without a path.

Every runner needs `DATABASE_URL` and `DATABASE_SSL`. Generation also needs
`BRIEFING_PUBLIC_BASE_URL`, set to the deployed web origin.

Optional delivery values are `EXPO_ACCESS_TOKEN`, `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
`TWILIO_FROM_NUMBER`. Leave an entire provider group unset when that provider is
not under test.

Do not place `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, provider credentials,
or the verification secret in web or mobile variables.

## Client environment

The web build needs:

- `NEXT_PUBLIC_API_URL`: public HTTPS API origin.
- `NEXT_PUBLIC_SUPABASE_URL`: test Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: test publishable key.

The EAS `preview` environment needs:

- `EXPO_PUBLIC_API_URL`: the same public HTTPS API origin.
- `EXPO_PUBLIC_SUPABASE_URL`: test Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: test publishable key.
- `EXPO_PUBLIC_EAS_PROJECT_ID`: Tempo's EAS project ID.

These values are embedded into client bundles and must never contain secrets.

## Promotion sequence

1. Provision a continuous container service from the Tempo Dockerfile.
2. Add the server environment and run `pnpm migrate:production`.
3. Start the API and verify `GET /health` returns `200`.
4. Create the four scheduled commands from `service-plan.yaml`.
5. Deploy the web app with the public API and Supabase values.
6. Update API CORS and `BRIEFING_PUBLIC_BASE_URL` to the final web origin.
7. Add the four mobile public values to the EAS `preview` environment.
8. Run `pnpm test:env:bootstrap` against the shared test database.
9. Run `pnpm test:env:smoke` with `TEST_API_URL` set to the public API origin.
10. Build the EAS `preview` profile and invite testers only after smoke passes.

## Rollback

Roll back the API and runner image together. Do not reverse a database migration
manually. Stop schedules before investigating a bad release, restore the prior
image, and keep the migration history intact. Canonical briefings and delivery
snapshots remain immutable.

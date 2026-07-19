# Briefing Delivery Runbook

## Purpose

`pnpm deliver:briefings` performs one bounded dispatch cycle. It claims due
delivery records, selects a provider by the record's channel, sends the
immutable stored payload, records the provider message ID or failure, and exits.
The same invocation then claims due Expo tickets, fetches receipts, records
acceptance/failure, and disables invalid device endpoints.

The command does not generate prose or read reusable story content.

## Required configuration

All cycles require:

- `DATABASE_URL`
- `DATABASE_SSL`: `true` or `false`

Optional worker controls:

- `DELIVERY_WORKER_ID`: generated from host, process, and UUID when omitted
- `DELIVERY_MAX_RECORDS`: default 50, maximum 100
- `DELIVERY_LEASE_SECONDS`: default 300
- `DELIVERY_MAX_ATTEMPTS`: default 5

The receipt cycle uses the same worker ID and bounded claim size. Receipt state
is persisted independently from dispatch so provider lag does not hold a
delivery lease.

Channel providers:

- Expo Push: `EXPO_ACCESS_TOKEN` is optional unless enhanced push security is
  enabled for the EAS project
- Resend: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` must be set together
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`
  must all be set; the from number must use E.164 format

Keep all credentials in managed secret storage. Delivery destinations and full
payloads are sensitive and must not be emitted to logs.

## Schedule

Invoke at least once per minute:

```bash
pnpm deliver:briefings
```

Parallel invocations are supported through row locks and expiring leases. The
command emits a structured `briefing_delivery_cycle_completed` event. Any failed
outcome produces a nonzero exit so monitoring can alert while the database
retains the retry schedule.

## Retry behavior

Transport errors, timeouts, rate limits, and provider server errors retry with
bounded exponential backoff. Provider validation/authentication failures are
terminal. An Expo `DeviceNotRegistered` ticket or receipt is terminal for the
current record. Receipt reconciliation also disables the matching endpoint
atomically.

Resend receives the delivery idempotency key. Expo and Twilio have an
at-least-once edge if a worker exits after remote acceptance but before local
success is committed. Before manually replaying an ambiguous record, check the
provider dashboard using its destination, schedule, and any available request
logs; do not blindly resend.

## Failure handling

1. Check that the provider for the failed channel is configured as a complete
   credential group.
2. Inspect provider status and the delivery's bounded `last_error`.
3. Restore credentials or provider availability, then allow `next_attempt_at` to
   become due.
4. Let expired leases be reclaimed automatically; do not clear live worker
   leases.
5. Treat malformed stored payloads as a code/data incident. Do not edit payload
   JSON by hand; repair with an audited forward script or cancel the record.
6. Invalid Expo endpoints are disabled automatically from receipts. Other
   destinations can be disabled through the owned endpoint API. Historical
   delivery records remain intact.

## Production enablement checklist

- Public briefing links resolve to authenticated web or universal-link routes.
- Email sending domain and from address are verified.
- SMS sender and destination consent requirements are satisfied.
- Expo project credentials are configured for the target mobile builds.
- Verify Resend/Twilio code delivery in the target environment; only verified
  endpoints are schedulable.
- Exercise overnight and daylight-saving quiet-hour cases in the deployment
  timezone set.
- Monitoring alerts on terminal failures, high retry counts, and provider error
  rates.
- Alert on Expo receipts that exhaust reconciliation retries.

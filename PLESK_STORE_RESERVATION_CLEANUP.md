# Plesk Store Reservation Cleanup

Plesk Scheduled Tasks is the authoritative Production trigger for releasing expired Store reservations. GitHub Actions remains an explicitly dispatched recovery path only because hosted cron delivery does not guarantee a five-minute execution interval.

## Safety boundaries

- Run every five minutes under the same subscription system user as the Node application.
- Run from the deployed repository root with `npm run job:store-reservation-cleanup`.
- Supply `STORE_RESERVATION_CLEANUP_SECRET` through the runtime environment only. Never paste it into the command, task description, output, Git, or screenshots.
- Keep `STORE_RESERVATION_CLEANUP_URL` at the Production HTTPS job endpoint.
- Configure Plesk to notify the operator when the task exits with an error.
- Do not configure a migration target or run Prisma migration commands for this task.

The runner holds a private lock so overlapping starts do not submit twice. The database cleanup remains idempotent through the existing Order status claim and Serializable inventory transaction. A successful run writes only an atomic private status record containing timestamps, the endpoint host, and aggregate candidate/released/skipped counts.

## Task command

Set the Plesk task working directory to the verified deployed repository root, then use only:

```text
npm run job:store-reservation-cleanup
```

Do not prefix the command with the secret. If Plesk does not supply the Node application environment to the scheduled shell, stop and correct the environment boundary without printing or copying the value.

## Readiness

The default alert threshold is 15 minutes. The normal task fails on a request, timeout, authentication, or response-validation error. If it recovers after the previous success became stale, it records the successful cleanup and exits non-zero once so Plesk can send an operator alert.

The operator can perform a read-only status check from the same runtime context:

```text
npm run check:store-reservation-cleanup
```

Expected healthy output is allowlisted JSON with `ready: true`, a reason, and age in minutes. It never returns the secret, request header, Order IDs, customer data, payment data, or stack traces.

## Production verification

1. Confirm the deployed Git commit and repository root.
2. Confirm the required environment key is present by key name only.
3. Run the non-migration preflight and application build.
4. Configure the five-minute task with error notification.
5. Allow one controlled task run; do not create an Order solely for this check.
6. Run the readiness command and confirm `ready: true`.
7. Confirm the task output contains only the safe event and aggregate counts.
8. Keep `/api/health` and authenticated Store/Admin route smoke checks read-only.

# Plesk Store Reservation Cleanup

The target authoritative Production trigger is a five-minute Plesk host-level task. GitHub Actions remains an explicitly dispatched recovery path only because hosted cron delivery does not guarantee a five-minute execution interval.

## Current Production blocker

Commit `dddce27` is deployed and the runner is ready, but the task is not active. Safe Plesk preflight confirmed that the customer-level Scheduled Tasks shell is chrooted: `/app.bccgroup-thailand.com` exists, while both `node` and `/opt/plesk/node/24/bin/node` are unavailable. The required Node application environment therefore could not be verified in that execution context. No invalid task was saved, no cleanup request was run, and the existing secret was not copied into a command or file.

The hosting operator must provide one of these approved boundaries before activation:

- a non-chrooted task running as the existing `bccgroup` system user with the existing Node application environment injected securely; or
- a provider-managed wrapper that exposes only the approved Node runtime and existing environment to this command without embedding or printing the secret.

Do not disable chroot globally, add a query-string secret, weaken endpoint authentication, or paste the secret into the task command.

## Safety boundaries

- Run every five minutes under the same subscription system user as the Node application.
- Run from the deployed repository root with `npm run job:store-reservation-cleanup`.
- Supply `STORE_RESERVATION_CLEANUP_SECRET` through the runtime environment only. Never paste it into the command, task description, output, Git, or screenshots.
- Keep `STORE_RESERVATION_CLEANUP_URL` at the Production HTTPS job endpoint.
- Configure Plesk to notify the operator when the task exits with an error.
- Do not configure a migration target or run Prisma migration commands for this task.

The runner holds a private lock so overlapping starts do not submit twice. The database cleanup remains idempotent through the existing Order status claim and Serializable inventory transaction. A successful run writes only an atomic private status record containing timestamps, the endpoint host, and aggregate candidate/released/skipped counts.

## Task command

After the hosting operator provides the runtime/environment boundary, set the task working directory to the verified deployed repository root. The expected host-level execution is equivalent to:

```text
cd /var/www/vhosts/bccgroup-thailand.com/app.bccgroup-thailand.com && /opt/plesk/node/24/bin/node scripts/store-reservation-cleanup-runner.cjs
```

Do not prefix the command with the secret. The hosting operator must verify the actual host path and environment injection without printing or copying the value before saving the task.

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

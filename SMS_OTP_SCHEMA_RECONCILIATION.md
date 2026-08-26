# SMS OTP Partial-Schema Reconciliation Runbook

This runbook is only for the confirmed Production shape associated with
`20260814090000_add_patient_phone_verification`. It is not a general migration runner.

## Safety Boundary

- Production execution requires a separate Project Controller approval after code review.
- Take and verify a fresh Production database backup immediately before the maintenance window.
- Keep `PLESK_MIGRATION_TARGET` absent throughout this procedure.
- Do not use Plesk **Run Node.js commands** for reconciliation. That runner does not inherit the Node application environment or `DATABASE_URL`.
- The only supported execution path is the guarded root `server.js` startup using the Node application runtime environment.
- Never leave the one-time target present or blank after an attempt. Remove the key entirely.
- Do not retry after any failure. Restore the verified backup instead of running ad-hoc DDL, `migrate resolve`, or destructive rollback SQL.
- The authoritative execution evidence is the private, non-public
  `runtime-private/sms-otp-schema-reconciliation-status.json` artifact. It is outside the configured
  `public` document root and contains only an
  allowlisted component, stage, status, optional action, version, and timestamp. Console output and
  Plesk `passenger.log` are secondary because the customer-level Plesk Log Browser does not expose
  Passenger output reliably.
- If the private status artifact cannot be written, the runner fails closed before database access.
  If an update fails after schema creation starts, it stops before migration resolution and the
  operator must treat the attempt as a possible mutation requiring schema classification and the
  approved recovery boundary.
- Before any future reconciliation approval, run
  `npm run check:plesk:sms-otp-reconciliation-status` with both migration target keys absent. This
  probe writes only `stage=diagnostics_probe status=ready` to the private artifact and does not read
  application environment values or connect to the database. A failed probe blocks reconciliation.

## Exact Preconditions

The guarded runner proceeds only when all conditions match:

1. The one-time key exists with this exact non-secret value:
   `PLESK_SMS_OTP_SCHEMA_RECONCILIATION_TARGET=20260814090000_add_patient_phone_verification:partial-schema-v1`.
2. `PLESK_MIGRATION_TARGET` is absent.
3. The reviewed migration file is still the latest source migration and matches its pinned SHA-256 fingerprint.
4. The named Prisma migration is not successfully applied.
5. The four added `User` columns, the referenced `User.id`, and both required `User` indexes exactly match the committed schema requirements. `User.id` must be `VARCHAR(191)` with `utf8mb4` and one closed-allowlist collation: `utf8mb4_unicode_ci`, `utf8mb4_general_ci`, `utf8mb4_bin`, or `utf8mb4_unicode_520_ci`.
6. `PhoneVerificationChallenge` and all of its columns, indexes, and foreign key are completely absent.
7. The Prisma CLI is present in the application root.

Empty, arbitrary, stale, conflicting, already-ready, partially present, or otherwise unexpected states fail closed before DDL.

For the string foreign key, `PhoneVerificationChallenge.userId` must match the character set and collation of `User.id`; the database default need not match. The runner selects only a static pre-reviewed `CREATE TABLE` option for the allowlisted `User.id` collation, never interpolates raw metadata into SQL, and verifies table plus FK-column parity before migration resolution and again afterward.

## Approved Execution Sequence

1. Confirm the reviewed reconciliation commit is the exact deployed commit.
2. Confirm the application is healthy and Admin schema readiness still reports the approved exact partial state.
3. Start a maintenance window that prevents new application writes.
4. Create a fresh named Production database backup and verify that Plesk reports it completed. Record its private identifier and restore owner outside Git.
5. Confirm the restore procedure and credentials are available before continuing.
6. Add only the exact one-time reconciliation key/value above to the Plesk Node application environment.
7. Restart the Node application once. The startup guard uses the application runtime environment, creates only the empty missing challenge table with its two indexes and foreign key, verifies schema parity, then invokes Prisma's supported `migrate resolve --applied 20260814090000_add_patient_phone_verification` mechanism.
8. The reconciliation startup intentionally does **not** start the application, even after success.
   Read the private status artifact through Plesk File Manager and accept only
   `stage=complete status=ready action=remove_target_and_restart`; do not inspect raw database,
   Prisma, or Passenger output.
9. Remove `PLESK_SMS_OTP_SCHEMA_RECONCILIATION_TARGET` entirely. Do not leave an empty value.
10. Restart the Node application once in normal mode.
11. Verify `/api/health` returns HTTP 200 with `status: ok`.
12. Verify Admin SMS OTP Environment remains ready and every Database schema component reports `ready`.
13. End the maintenance window. A subsequent Controlled OTP UAT still requires separate approval.

## Failure And Restore Plan

If source validation, preconditions, schema creation, parity verification, Prisma migration resolution, or final parity fails:

1. Do not restart with the one-time target again and do not run a manual repair command.
2. Keep OTP and application writes paused.
3. Remove the one-time reconciliation key entirely.
4. Restore the verified fresh backup using the pre-approved Plesk database restore procedure and assigned restore owner.
5. Rebuild/restart only after the restored database is confirmed and the Project Controller approves recovery.
6. Recheck health and Admin schema readiness read-only, then document the safe failure stage.

The reconciliation creates an empty table only. It never changes `User` rows or existing `User` columns/indexes, and it never reads or emits patient, credential, datasource, or record values.

## Production Attempt And Observability RCA (2026-08-26)

- Phase A deployed reviewed commit `4e2c08a`. Plesk is configured with application root
  `/app.bccgroup-thailand.com`, startup file `server.js`, and the root wrapper passes `__dirname` as
  the guarded runtime root before starting `.next/standalone/server.js`.
- The deployed root wrapper, startup integration, reconciliation runner, reviewed migration hash,
  latest-migration ordering, Prisma CLI, and standalone server were all verified present.
- The first Phase B target restart failed closed, but Admin schema readiness returned to the exact
  original partial state after target removal and one normal restart. Therefore no challenge-table
  DDL occurred and no restore was required.
- The exact pre-DDL rejection sub-stage cannot be reconstructed from commit `4e2c08a`: its safe
  diagnostics existed only on `console.log`/`console.error`, while Plesk listed the global
  `passenger.log` but returned zero readable rows for it in Log Browser. The target was not retried.
- The follow-up code-only patch adds the private allowlisted status artifact and makes its successful
  write a prerequisite for continuing. It does not authorize another Production target, restart,
  reconciliation, migration, or database mutation.
- The patch also adds a no-environment/no-database status-path probe so Production filesystem
  observability can be verified separately, with both target keys absent, before any separately
  approved reconciliation attempt. The probe itself also requires explicit Production approval.

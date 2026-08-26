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

## Exact Preconditions

The guarded runner proceeds only when all conditions match:

1. The one-time key exists with this exact non-secret value:
   `PLESK_SMS_OTP_SCHEMA_RECONCILIATION_TARGET=20260814090000_add_patient_phone_verification:partial-schema-v1`.
2. `PLESK_MIGRATION_TARGET` is absent.
3. The reviewed migration file is still the latest source migration and matches its pinned SHA-256 fingerprint.
4. The named Prisma migration is not successfully applied.
5. The four added `User` columns, the referenced `User.id`, both required `User` indexes, and table/database collation compatibility exactly match the committed schema requirements.
6. `PhoneVerificationChallenge` and all of its columns, indexes, and foreign key are completely absent.
7. The Prisma CLI is present in the application root.

Empty, arbitrary, stale, conflicting, already-ready, partially present, or otherwise unexpected states fail closed before DDL.

## Approved Execution Sequence

1. Confirm the reviewed reconciliation commit is the exact deployed commit.
2. Confirm the application is healthy and Admin schema readiness still reports the approved exact partial state.
3. Start a maintenance window that prevents new application writes.
4. Create a fresh named Production database backup and verify that Plesk reports it completed. Record its private identifier and restore owner outside Git.
5. Confirm the restore procedure and credentials are available before continuing.
6. Add only the exact one-time reconciliation key/value above to the Plesk Node application environment.
7. Restart the Node application once. The startup guard uses the application runtime environment, creates only the empty missing challenge table with its two indexes and foreign key, verifies schema parity, then invokes Prisma's supported `migrate resolve --applied 20260814090000_add_patient_phone_verification` mechanism.
8. The reconciliation startup intentionally does **not** start the application, even after success. Accept only the safe completion stage; do not inspect raw database or Prisma output.
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

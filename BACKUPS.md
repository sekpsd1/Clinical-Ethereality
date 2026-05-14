# Backup And Restore Runbook

Clinical Ethereality stores sensitive operational records, including consultations, prescriptions, payment reviews, orders, shipment tracking, rewards, notifications, and moderation records. Backups must be enabled and restore-tested before production onboarding.

## Scope

Back up these systems once selected and enabled:

- Managed MySQL database
- Object storage for slips, prescriptions, PDFs, images, and attachments
- Deployment configuration and environment variable inventory
- Prisma migrations and application source through git

Do not store raw secrets in backup runbooks, tickets, or shared documents.

## Environment Policy

Preview:

- Use disposable or low-retention non-production data.
- No patient-like or payment-live records.
- Restore testing is optional.

Staging:

- Use a dedicated staging database.
- Enable automated backups before staff acceptance testing.
- Run restore drills with synthetic data only.
- Keep staging backups separate from production.

Production:

- Enable automated daily backups before launch.
- Enable point-in-time recovery when the managed MySQL provider supports it.
- Take a manual snapshot before schema changes, large imports, or provider credential changes.
- Keep production backups access-restricted to approved operators.
- Test restore before patient-like records are entered.

## Recommended Targets

- Recovery point objective: 24 hours or better for MVP, lower when provider point-in-time recovery is available.
- Recovery time objective: 4 hours for MVP operational recovery.
- Retention: 30 days minimum for database backups, adjusted after legal/compliance review.
- Audit retention: follow `AUDIT_LOG_RETENTION_DAYS` and compliance guidance, currently documented as 2555 days.

## Database Backup Checklist

Before production launch:

- Confirm the managed MySQL provider has automated backups enabled.
- Confirm backup retention period.
- Confirm point-in-time recovery availability.
- Confirm encryption at rest and in transit.
- Confirm who can create, list, restore, and delete backups.
- Confirm restore target behavior: new database preferred over in-place restore.
- Record provider, project, database name, retention, and restore owner in the private operations tracker.

Before risky changes:

- Confirm the latest automated backup completed.
- Create a manual snapshot when supported.
- Run `npx prisma validate`.
- Confirm rollback or forward-fix plan.

## Restore Drill

Run this drill in staging before production launch and after major schema changes:

1. Create or identify a recent staging backup.
2. Restore it into a new isolated staging database.
3. Point a temporary staging deployment or local environment at the restored database.
4. Run `npx prisma validate`.
5. Open `/api/health`.
6. Sign in through staging auth or an approved non-production test path.
7. Verify representative customer, admin, doctor, and pharmacist pages load.
8. Confirm no production credentials or production data are present.
9. Record restore duration, issues, and follow-up actions.

## Object Storage Backup Checklist

Once file storage is selected:

- Use a dedicated bucket/account per environment.
- Enable object versioning when supported.
- Enable lifecycle retention appropriate for payment slips, prescriptions, PDFs, and images.
- Restrict public access by default.
- Store metadata in MySQL and file bytes in object storage.
- Verify restore or object recovery for a deleted test object in staging.

## Incident Restore Procedure

For suspected data loss or corruption:

1. Pause risky write paths when possible.
2. Identify affected record types and time window.
3. Preserve logs and audit records.
4. Choose restore target: new database is preferred.
5. Restore from the latest known-good backup.
6. Validate schema compatibility and application health.
7. Reconcile records created after the restore point when required.
8. Document incident, root cause, restore time, and prevention tasks in `PROJECT_STATE.md`.

## Launch Gate

Production remains blocked until:

- Production database backups are enabled.
- Staging restore drill has passed.
- Backup access ownership is assigned.
- Restore procedure is documented.
- Object storage backup/versioning decision is recorded once storage is selected.

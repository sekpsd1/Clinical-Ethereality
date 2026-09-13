# Purge stuck UAT consultations

This operator-only command permanently removes exactly three `live` consultations for one explicitly selected test customer. It preserves the customer account, shared assessments, and exactly two `scheduled` consultations. It has no admin UI and is dry-run by default.

## Safety boundary

- Supply the exact test customer selector only through `ADMIN_PURGE_UAT_LINE_USER_ID`. The value is never printed.
- Dry-run output contains only an opaque SHA-256 fingerprint and aggregate counts.
- Execute mode refuses any target other than exactly three `live` consultations and exactly two preserved `scheduled` consultations for the same customer.
- Execute mode requires the dry-run fingerprint, every expected aggregate count, an exact database host/name boundary, the production confirmation phrase, and a verified backup no older than 60 minutes.
- Zoom recording IDs must map exactly to the scoped database metadata. Missing credentials/scopes or any provider mismatch fails closed before file or database deletion.
- Private payment slips must be exclusively referenced, owned by the target customer/payment, inside `PAYMENT_UPLOAD_DIR`, non-symlink regular files, and match stored size and image magic. Missing files are allowed only for an idempotent retry after a partial attempt.
- Provider and private-file deletion happen before one serializable database transaction. Any failure is reported as failure. A retry revalidates the same scope and completes the remaining work.
- Logs and reports must never include customer/consultation/payment/recording IDs, paths, URLs, payloads, or secrets.

## Dry-run

Set `DATABASE_URL` and `ADMIN_PURGE_UAT_LINE_USER_ID` in the operator environment, then run:

```powershell
npm run admin:purge-stuck-uat-consultations
```

Expected approved aggregate counts are:

```json
{"liveConsultations":3,"scheduledConsultations":2,"liveConsultationDays":2,"attendanceCredentials":11,"attendanceEvents":0,"messages":0,"recordings":15,"recordingWebhookEvents":5,"telemedicineConsents":3,"payments":3,"prescriptions":0,"slotLocks":3,"privateAttachments":3,"directAuditRows":65}
```

Stop if any count differs. Do not copy raw database or provider records into tickets, chat, or logs.

## Execute gate

Execution is a separate, explicitly reviewed production operation. Before it, create and verify a fresh database backup using the approved infrastructure procedure. Set these values in the operator environment without committing them:

- `ADMIN_PURGE_BACKUP_VERIFIED=true`
- `ADMIN_PURGE_BACKUP_REFERENCE=<opaque backup reference>`
- `ADMIN_PURGE_BACKUP_CREATED_AT=<ISO-8601 timestamp>`
- `PAYMENT_UPLOAD_DIR=<absolute private payment storage root>`
- the existing Zoom Server-to-Server OAuth credentials

Run execute mode only with the exact values returned/verified by the immediately preceding dry-run:

```powershell
npm run admin:purge-stuck-uat-consultations -- --execute --confirm=<64-character-fingerprint> --expected-counts=<single-line-json> --expected-host=<database-host> --expected-database=<database-name> --confirm-production=PURGE_STUCK_UAT_LIVE_ONLY
```

Success is reported only after aggregate verification confirms zero scoped live consultations/dependencies, two scheduled consultations, and the retained customer account. If the command fails after provider or file deletion, keep the backup and rerun the complete command with a fresh dry-run and confirmation; do not manually edit the database.

# Purge four Websthai live UAT consultations

This one-time operator command removes exactly four `live` UAT consultations belonging to the unique active Customer whose exact `displayName` or `fullName` is `Websthai`. Every target must fall on 16, 17, or 18 September 2026 in `Asia/Bangkok`, with all three dates represented. It preserves the Customer, Doctors, Doctor availability/date overrides, assessments, every non-target Consultation, and all physical files.

## Safety boundary

- The command is dry-run by default and prints aggregate counts plus opaque hashes only. It never prints record identifiers, provider identifiers, storage paths, URLs, credentials, or payloads.
- Execute mode requires exactly four target Consultations, exactly three approved Bangkok dates, the dry-run fingerprint and full counts, a preservation fingerprint, the hashed database boundary, the exact Production confirmation phrase, and a verified Plesk backup created within 60 minutes.
- Consultation Payments must not link to an Order. Prescriptions with commerce dependencies fail closed.
- Zoom recording lists and Google Drive archive objects are inspected read-only before deletion and rechecked afterward. The command contains no Zoom or Google Drive delete request.
- Payment evidence and other private files are validated before deletion and checked again afterward. Database attachment metadata may be removed with the target graph, but file bytes are preserved for recovery.
- Active Drive upload/deletion leases fail closed. Archived Drive objects must match the expected private folder, recording binding, MIME type, and size.
- One Serializable transaction re-reads the exact graph and rejects fingerprint/count drift before deleting scoped audit rows, attachment metadata, notifications, handoff sessions, recording metadata/webhook rows, attendance rows, messages, consent, Payments, Prescriptions, the four Consultations, and their slot locks.
- The post-check requires zero scoped Consultation/dependency rows, the Customer to remain, all scheduled Consultations to remain, unchanged preservation counts, and unchanged Zoom/Drive/private files.

## Dry-run

Run through the Production Node.js command surface after the reviewed source is deployed:

```text
run admin:purge-four-websthai-live
```

Review the aggregate report. Continue only when `customerMatched=true`, `targetDates` is exactly `2026-09-16` through `2026-09-18`, `liveConsultations=4`, external checks pass, and `physicalFilesWillBeDeleted=false`.

## Backup

Create a fresh full Plesk backup that includes the application files and database. Verify its completion and record its opaque name/reference and completion timestamp. Zoom and Google Drive files are not included in that backup because the purge must preserve them in place.

## Execute

Use the exact fingerprint, preservation hash, database-boundary hash, and complete counts object returned by the immediately preceding dry-run. The backup timestamp must be ISO-8601 and no more than 60 minutes old.

```text
run admin:purge-four-websthai-live -- --execute --confirm=<fingerprint> --expected-counts=<single-line-json> --preservation=<preservation-hash> --database-boundary=<boundary-hash> --backup-verified=true --backup-reference=<opaque-reference> --backup-created-at=<ISO-8601> --confirm-production=PURGE_WEBSTHAI_FOUR_LIVE_PRESERVE_EXTERNAL
```

Do not retry a failed execute blindly. Inspect the safe failure code and the completed backup first. A successful report must explicitly confirm Customer, schedules, other Consultations, Zoom files, Drive files, and private files were preserved.

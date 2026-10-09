# Purge four Websthai live UAT consultations

This one-time operator command removes exactly four owner-confirmed `live` UAT consultations assigned to Doctor `Websthai`. Identify the unique active Customer with the privately supplied `--customer-label` and require `--target-set` to match the SHA-256 of the sorted, UI-verified Consultation ID array. Every target must fall on 16, 17, or 18 September 2026 in `Asia/Bangkok`, with all three dates represented. It preserves the Customer, Doctors, Doctor availability/date overrides, assessments, every non-target Consultation, and all physical files. The original assumption that `Websthai` was the Customer was corrected and explicitly confirmed by the owner before execution.

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

On this Plesk host, append `-- --plesk-runtime-env --customer-label=<owner-confirmed-label> --target-set=<approved-ID-set-hash>`. The explicit runtime option reads only allowlisted variables from same-host Node processes bound to the exact Production app URL; conflicting candidate environments fail closed. It neither prints nor persists environment values.

Review the aggregate report. Continue only when `customerMatched=true`, `doctorMatched=true`, `targetDates` is exactly `2026-09-16` through `2026-09-18`, `liveConsultations=4`, external checks pass, and `physicalFilesWillBeDeleted=false`. Already absent external recordings are reported separately; before/after checks preserve the exact existing provider file sets. Manual evidence must bind to the exact scoped Payment and its reviewer; retained private files are checked for owner directory, root containment, exclusivity, size and unchanged content hash.

## Backup

Create a fresh full Plesk backup that includes the application files and database. Verify its completion and record its opaque name/reference and completion timestamp. Zoom and Google Drive files are not included in that backup because the purge must preserve them in place.

## Execute

Use the exact fingerprint, preservation hash, database-boundary hash, and complete counts object returned by the immediately preceding dry-run. The backup timestamp must be ISO-8601 and no more than 60 minutes old.

```text
run admin:purge-four-websthai-live -- --execute --confirm=<fingerprint> --expected-counts=<single-line-json> --preservation=<preservation-hash> --database-boundary=<boundary-hash> --backup-verified=true --backup-reference=<opaque-reference> --backup-created-at=<ISO-8601> --confirm-production=PURGE_WEBSTHAI_FOUR_LIVE_PRESERVE_EXTERNAL
```

Do not retry a failed execute blindly. Inspect the safe failure code and the completed backup first. A successful report must explicitly confirm Customer, schedules, other Consultations, Zoom files, Drive files, and private files were preserved.

## Completed operation

The owner-confirmed operation executed once successfully on 2026-10-09 at operator commit `6f3596b`. Full backup task `1501`, created at 18:07:46 ICT, completed at 100% and remains available as a 2.69 GB restore entry. Four target Consultations and their scoped dependencies were removed; all preservation checks passed. The Doctor queue displayed zero live Consultations afterward and retained 17 completed Consultations. Production health returned HTTP 200 with `status: ok`. Do not rerun this completed cleanup.

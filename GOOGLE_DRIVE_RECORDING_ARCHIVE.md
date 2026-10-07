# Google Drive consultation-recording archive

Local implementation only. The integration is **disabled by default**. Deployment, migration,
Google account grant/configuration, credentials, scheduled job setup and controlled transfer UAT
require the separate release/configuration scope. No Zoom deletion or automatic retention deletion
is implemented. Existing five-year metadata remains unchanged; Drive is not immutable storage.

## One-time owner/operator setup

1. Use the approved Workspace account. Enable Google Drive API in its organization project.
2. Configure Google Auth Platform audience as Internal when Workspace policy permits. Otherwise
   publish the External OAuth app appropriately: External Testing refresh tokens for Drive scope
   expire after seven days. Add only `https://www.googleapis.com/auth/drive.file` as data access.
3. Create a **Web application** OAuth client. Register exactly
   `http://127.0.0.1:53682/oauth/callback` as its one-time local setup redirect URI.
   The app has no public OAuth setup endpoint. Neither a service account nor browser cookies/passwords
   are used for My Drive storage.
4. On a trusted operator computer create a private directory outside the Git checkout and web root.
   Restrict Windows directory ACL to that operator, or use Unix mode 0700. Supply `GOOGLE_DRIVE_CLIENT_ID`,
   `GOOGLE_DRIVE_CLIENT_SECRET` and a new absolute `GOOGLE_DRIVE_ARCHIVE_SETUP_OUTPUT` file path in the
   process environment; run `node scripts/setup-google-drive-archive.cjs`.
   Alternatively read a downloaded Web OAuth client JSON securely without echoing values:
   `node scripts/setup-google-drive-archive.cjs --client-json <private-client-json-path> --output <new-private-output-path>`.
5. Open the printed authorization URL in the browser already signed into the approved Workspace
   account. Verify the account before granting. The loopback-only callback validates random state
   and PKCE, requests offline access, creates one private app-owned destination folder and writes
   credentials/settings to the new operator-only file. It does not print tokens or overwrite files.
   A callback/folder timeout is ambiguous: inspect Drive first before rerunning to avoid spare folders.
6. Transfer configuration through the approved secret-management channel into Plesk server environment;
   never paste the private file into chat, Git, logs, browser URLs or screenshots. Remove the operator
   secret file after secure transfer according to the operator's credential handling procedure.
   Keep a protected recoverable copy of the session encryption key while uploads are in progress.

## Release prerequisites

- Review/apply prepared migration `20261007120000_google_drive_recording_archive` after a verified backup.
  Do not enable archive before migration. The migration gives existing recordings pending state;
  only unexpired eligible MP4 and Zoom chat TXT metadata are candidates. Clinical Lab chat is separate.
- Set `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`,
  `GOOGLE_DRIVE_ARCHIVE_FOLDER_ID`, `GOOGLE_DRIVE_ARCHIVE_SESSION_KEY` (64 hex characters),
  `GOOGLE_DRIVE_ARCHIVE_JOB_SECRET` (at least 32 characters), then
  `ENABLE_GOOGLE_DRIVE_RECORDING_ARCHIVE=true` only for approved controlled UAT.
- Folder must have been created by the same OAuth app and remain private: only the owner permission
  is admitted. This phase supports My Drive only, not Shared Drives. Never share destination files
  or publish Drive links. If sharing changes, app archive operations fail closed and playback falls
  back to Zoom. The owner can still share outside this app; account governance remains their responsibility.
- Set Plesk scheduled task once per minute to run `node scripts/recording-archive-runner.cjs` from the
  app checkout with the job secret and canonical HTTPS app origin in its environment. Verify Plesk
  scheduled-task environment separately from Node application's environment. Capture exit status;
  alert on nonzero outcomes. The endpoint accepts POST with a timing-safe secret check and returns
  only aggregate status, never tokens, file IDs or recording details. No public user trigger is exposed.

## Operational behavior and recovery

Each job processes at most one 8 MiB chunk. State is durable in `ConsultationRecording`; leases avoid
concurrent writers and expire after five minutes. Upload session capabilities are AES-256-GCM
encrypted with the recording ID bound as authenticated data. A Drive-generated file ID is persisted
before upload creation, so a lost final response is reconciled with `files.get`, never a second file.
Every retry probes provider-acknowledged offset instead of trusting the last local offset. Network
failures use capped exponential retry and stop after 12 consecutive failures. Progress resets the
consecutive failure count. Expired sessions restart using the same reserved file ID.

A recording is `archived` only after Drive file ID, source-reported size, MIME, private parent and
app-specific recording binding are verified; completion audit and state change are atomic. The
existing assigned-Doctor/Admin authorization, external handoff, byte ranges and view/download audit
are unchanged. Server proxying uses Drive only after verification and keeps Zoom as fallback.
Metadata verification is not a cryptographic end-to-end checksum proof; real-content UAT must compare
a controlled file download before acceptance. No provider URL or Google credential is exposed to users.

Operator-only database checks should report counts by `archiveStatus`, recent `archivedAt`, and stale
leases, without exporting patient/provider details. Investigate failed status before an approved
exact-record retry (`archiveStatus=pending`, `archiveAttempts=0`, `archiveRetryAt=NULL`); retain
`archiveDriveFileId` and encrypted session to preserve idempotency. Do not blindly clear IDs or copy files.
Unknown source size or non-range TXT over 8 MiB fails closed for operator review. MP4 requires Zoom to
honor the requested byte range; otherwise it fails rather than loading the full video into memory.

For rollback, disable the flag and scheduled task, restart Node, retain schema/upload state and Zoom
files. Existing playback then uses Zoom. No recording is deleted by this integration. Restore/revoke
credentials only through approved recovery procedures.

## Acceptance evidence before activation

Test an exact non-sensitive authorized recording: one private Drive file, byte download comparison,
Doctor/Admin playback/download and ranges; Customer/anonymous/cross-doctor denial; retry after a lost
upload response and Node restart; lease concurrency; expired/invalid OAuth, quota exhaustion and Zoom
fallback; repeat webhook/job does not create another file. Verify actual available Drive storage quota,
licensed account longevity, scheduled-job monitoring and account access before bulk backfill. Automatic
five-year deletion, Drive previews/public links, Shared Drive and Clinical Lab TXT exports are out of scope.

**Release blocker:** existing Admin/Test-UAT deletion paths do not yet remove Drive archived files.
Before activation, the Admin owner must integrate exact private Drive cleanup (including in-progress
reserved IDs) and verify scoped account/consultation deletion does not orphan private recording bytes.
This implementation deliberately leaves those independently owned paths untouched and remains disabled.

Official references:
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/identity/protocols/oauth2/web-server

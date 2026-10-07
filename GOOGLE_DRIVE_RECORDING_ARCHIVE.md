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
  scheduled-task environment separately from Node application's environment. Alternatively use
  `--config /absolute/private-sibling/runner.json` containing only `NEXT_PUBLIC_APP_URL` and
  `GOOGLE_DRIVE_ARCHIVE_JOB_SECRET`. Verify a 0700 directory outside application/document roots
  and a 0600 regular file before uploading the minimal configuration; never include OAuth tokens
  in this runner file or put secret values into scheduled command arguments. Use the actual host
  Node executable and source checkout script path, not an assumed standalone script path. Capture exit status;
  alert on nonzero outcomes. The endpoint accepts POST with a timing-safe secret check and returns
  only aggregate status, never tokens, file IDs or recording details. No public user trigger is exposed.

## Operational behavior and recovery

Each job processes at most one 8 MiB chunk (roughly 8 MiB/minute with the recommended schedule;
large files/backlogs can take hours, not immediate delivery). State is durable in `ConsultationRecording`; leases avoid
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

## Permanent Test/UAT deletion integration

Admin account deletion locks exact related recording rows, rejects active upload leases (including jobs
that have not reserved a Drive ID), fences future claims and cleans private bytes before removing rows.
The existing flag may be off; retained archive credentials are still needed for cleanup. Persisted upload
sessions are cancelled and probed for terminal state; already-completed sessions are reconciled against
their exact file. DELETE targets only the stored app-bound, parent-bound owner file ID, including an
owner file accidentally shared or trashed. Shared files remain ineligible for playback/completion.
Provider404 is idempotent. Provider failure rolls back DB deletion and retains mapping/session for retry;
no success is reported while cleanup is unverified. Cleanup has a 45-second overall network budget,
individual requests at most eight seconds (two cancellation calls divide that budget), and the Admin
serializable transaction has a 120-second timeout. Large account deletions can require operator review
and an exact retry after partial external cleanup; never clear IDs to bypass a failure.

Legacy `reset-consult-flow-data.cjs` and `purge-stuck-uat-consultations.cjs` now refuse archive mappings
or active leases before their destructive scope; their transaction guards lock exact recording rows.
Use reviewed exact archive cleanup before legacy purge; do not bypass those preflights.

Controller-run non-sensitive synthetic provider diagnostics on 2026-10-07 verified private folder,
available quota, TXT upload/download byte equality, completed-session immutability, interrupted upload
status308, cancellation499, status-probe499 and rejected resume499, with zero synthetic files remaining.
The earlier diagnostic attempts/recovery are separate from application UAT. Session requests must use
`redirect: manual`: 308 is resumable progress, not a redirect to follow or reject. Cancellation behavior
was verified against the current provider rather than assumed from historical GData documentation.
The synthetic operator tool accepts private config/recovery paths and reports only booleans/counts,
safe stage/error classifications and numeric HTTP statuses. `--recover-only` creates no new files and
cleans only exact retained app-marker-bound synthetic IDs. Config/recovery capabilities stay private.
Full application schema/deployment/restart and authorized-recording UAT are still pending.

Official references:
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/identity/protocols/oauth2/web-server

# Plesk chroot scheduler alternative

If the existing cron chroot cannot access the verified Plesk Node executable, do not change SSH, shell, or chroot security. Where `/bin/curl` is already available, prepare a private minimal curl configuration with `scripts/prepare-recording-archive-runner-config.cjs --config ABSOLUTE_PRIVATE_INPUT --output ABSOLUTE_NEW_PRIVATE_OUTPUT --curl`. Only the canonical HTTPS job URL, POST method and job header are exported. Upload that output only into a verified owner-only (0700) directory outside the app/public root, and set the file to 0600 before testing.

Use `/bin/curl --disable --config /clinical-archive-ops/runner-config.curl --proto =https --max-time 150 --connect-timeout 15 --silent --show-error --fail` in the existing chroot. `--disable` must be first, avoiding inherited curlrc options. Do not follow redirects, disable TLS checks, or put secrets into command arguments/URLs. Test once with the feature off (expected HTTP 503), then verify an enabled manual successful archive step before creating one active per-minute task. HTTP 503 with the flag off proves transport, not authentication. Responses contain aggregate job status only.

If the existing chroot lacks its default CA bundle, never use insecure TLS options. `scripts/prepare-recording-archive-ca-bundle.cjs --output ABSOLUTE_NEW_PRIVATE_FILE` exports the installed official Node runtime's bundled Mozilla roots and reports source/version/count/SHA256 only. Upload into the same verified private directory, set 0600, and verify the uploaded SHA256 matches. Add `--cacert /clinical-archive-ops/ca-bundle.pem` to the command. Keep this trust bundle updated with the official Node runtime; do not export browser cookies or add arbitrary/self-signed trust roots.

2026-10-07 operator provisioning: installed official Node v24.12.0 exported 146 bundled Mozilla roots; uploaded SHA256 verified `b3efddb96fca5c2602ca1d07c9e5471541d539f38daf9bf54ec334ba11f9232c`. Plesk runtime remains v24.21.0; no runtime downgrade or chroot/shell/security change.

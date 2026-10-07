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
That synthetic test did not establish application acceptance. See the release checkpoint below for later application deployment and the remaining real-recording UAT.

Official references:
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/identity/protocols/oauth2/web-server

# Plesk chroot scheduler alternative

If the existing cron chroot cannot access the verified Plesk Node executable, do not change SSH, shell, or chroot security. Where `/bin/curl` is already available, prepare a private minimal curl configuration with `scripts/prepare-recording-archive-runner-config.cjs --config ABSOLUTE_PRIVATE_INPUT --output ABSOLUTE_NEW_PRIVATE_OUTPUT --curl`. Only the canonical HTTPS job URL, POST method and job header are exported. Upload that output only into a verified owner-only (0700) directory outside the app/public root, and set the file to 0600 before testing.

Use `/bin/curl --disable --config /clinical-archive-ops/runner-config.curl --proto =https --max-time 150 --connect-timeout 15 --silent --show-error --fail` in the existing chroot. `--disable` must be first, avoiding inherited curlrc options. Do not follow redirects, disable TLS checks, or put secrets into command arguments/URLs. Test once with the feature off (expected HTTP 503), then verify an enabled manual successful archive step before creating one active per-minute task. HTTP 503 with the flag off proves transport, not authentication. Responses contain aggregate job status only.

If the existing chroot lacks its default CA bundle, never use insecure TLS options. `scripts/prepare-recording-archive-ca-bundle.cjs --output ABSOLUTE_NEW_PRIVATE_FILE` exports the installed official Node runtime's bundled Mozilla roots and reports source/version/count/SHA256 only. Upload into the same verified private directory, set 0600, and verify the uploaded SHA256 matches. Add `--cacert /clinical-archive-ops/ca-bundle.pem` to the command. Keep this trust bundle updated with the official Node runtime; do not export browser cookies or add arbitrary/self-signed trust roots.

2026-10-07 operator provisioning: installed official Node v24.12.0 exported 146 bundled Mozilla roots; uploaded SHA256 verified `b3efddb96fca5c2602ca1d07c9e5471541d539f38daf9bf54ec334ba11f9232c`. Plesk runtime remains v24.21.0; no runtime downgrade or chroot/shell/security change.

## Diagnostic release checkpoint and next review (2026-10-07)

Archive2 reused the clean archive branch at `27bded7fb2d37fa034525e3cb83cb338c3bbb62c`.
The expected remote `350fba3` was reverified before a normal fast-forward push to `main`.
Plesk Pull/Deploy confirmed `27bded7`; non-migration preflight and `build:plesk-host` passed
on Node 24.21.0, including lint/type checks, 67 generated pages and 137 static/24 public
files verified. One explicit restart was followed by health HTTP 200 / `status: ok`.
This worker turn added one successful host build, one restart and one manual job;
it repeated no migration and saved no environment changes. Earlier handoff counts
remain separate. The existing private backup and additive archive columns were retained.

The single approved job returned only:
`status=retry`, `stage=zoom_download`, `code=CONTENT_UNAVAILABLE`,
`reason=content_mime`, `httpStatus=206`. It did not complete a recording copy.
The unsaved scheduler form was cancelled and the task list verified empty.
No periodic task is active. Do not repeat the job using its consumed one-run approval.

Evidence proves the application reached its MIME rejection after a Zoom partial-content
response. It does not identify the returned MIME, prove expiration, validate media bytes,
or justify new download hosts or arbitrary binary acceptance.
The current policy requires `video/mp4` for the canonical MP4 pair and `text/plain`
with an absent or UTF-8 charset for the canonical chat TXT pair.

Zoom's [Get meeting recordings](https://developers.zoom.us/docs/api/meetings/)
and [Download URL guidance](https://developers.zoom.us/docs/api/using-zoom-apis/#download-url)
describe dynamically generated download URLs and Bearer authentication, including
the optional `download_access_token`. The reviewed documentation does not establish
the response MIME for this request; no token/authentication change is justified by
the observed MIME failure alone.

### Reviewed MIME diagnostic and release evidence

The provider now classifies rejected MIME headers into exactly `missing`, `octet_stream`,
`html`, `video_mp4`, `text_plain`, or `other`. Parameters, unknown header text, URLs,
tokens and media bytes are never returned. Missing headers are distinguished before
the existing octet-stream fallback. Content remains rejected and its stream cancelled.
The archive serialization boundary independently allowlists the class and emits it
only for `content_mime`; forged values and unrelated reasons omit the field.
There is no policy, authentication, transfer, host, schema or scheduler change.
Local verification passed 62 focused provider/archive/policy/job tests, TypeScript
typecheck, ESLint and the 67-page Next build. Controller16 accepted the diagnostic-only
local review and authorized scoped commit `ea1386ef24f78ac374db3392fe27784b684aff66`.

After direct owner approval, that commit was deployed to the exact existing Plesk app.
Non-migration preflight and the 67-page host build passed, with 137 static and 24 public
files verified. One explicit restart was followed by health HTTP200 / `status: ok`.
Exactly one additional manual invocation returned `retry / zoom_download /
CONTENT_UNAVAILABLE / content_mime / 206 / octet_stream`. This proves the request's
MIME essence was `application/octet-stream`, not that its bytes were valid MP4.
No copy completed, no policy was changed, and the unsaved task was cancelled; the
scheduler list remained empty. This release added host build1/restart1/job1,
environment saves0/migration0. Credential recovery remains unexecuted.
The single-run approval is consumed; do not rerun under it.

The following was the reviewed, now-consumed runtime validation proposal. Proposed exact runtime
validation: reverify the reviewed commit and remote, deploy only that diagnostic,
non-migration build and one restart/health check, then run the existing private curl
command once with no saved/active scheduled task. Return only the existing fixed
stage/code/reason/status plus `mimeClass`. Do not clear attempts, leases, file IDs or
encrypted sessions to force selection. `idle` is inconclusive and does not authorize
a second invocation. Selection remains the existing one-eligible-record queue policy;
an exact-record probe would need a separate reviewed design.

If `octet_stream` is observed, prepare a separate MP4-only proposal with bounded
format validation and range/size binding; that class alone does not prove MP4 content.
If `html`, investigate an authentication/login response without exposing its body.
If `missing`, `other` or a crossed MIME is observed, retain rejection and prepare
bounded additional evidence. Any eventual fix must retain strict TXT handling,
canonical metadata, private proxy authorization, safe hosts, byte-range limits and
Drive completion/privacy verification. Real copy/view/download/ranges, unauthorized
denial, concurrency and restart recovery remain incomplete.

## Credential exposure review proposal; no rotation performed

An unfiltered Node dashboard accessibility snapshot exposed environment values in tool
output during the release. This document records key names and dependencies only.
Do not reproduce the snapshot, values, header strings, screenshots or provider payloads.
No credential rotation, revocation, permission change or data rewrite has been executed.
Controller/owner must approve the exact targets, credentials channel, maintenance
window, validation and rollback before recovery mutations.

Proposed order, subject to owner review:

1. Establish an owner-controlled recovery channel and verify backups privately. Inventory
   all consumers by key name, including Plesk runtime, operator configuration, job runners,
   webhooks and other hosts. Keep scheduler inactive. Build a recovery checklist without
   copying environment values into chat, Git or screenshots. Unexposed credentials do
   not automatically require rotation; public IDs, paths and flags are not secrets.
2. Rotate `DATABASE_URL`'s database-user password and `JWT_SECRET` in an agreed short
   maintenance window. Database provider and runtime must agree before returning service;
   verify health and authenticated database reads. JWT is shared by access/refresh tokens,
   staff invites and Zoom handoff flows: existing signed capabilities will fail, so verify
   fresh LINE login and require users to obtain new invites/handoffs. Current code has one
   JWT key, not an overlapping key ring. Do not test by invoking payment or meeting creation.
3. Rotate `GOOGLE_DRIVE_CLIENT_SECRET` and replace/revoke the exposed
   `GOOGLE_DRIVE_REFRESH_TOKEN` under the existing OAuth client/account and `drive.file`
   scope. Do not substitute a new client or broaden scope: existing file ownership/access
   is a dependency. Reauthorization/revocation order depends on provider support for
   overlapping credentials; verify privately before executing. Token revocation can affect
   the app grant, so do not assume a new token from the same grant survives revocation.
   Google's current revocation documentation states that revocation invalidates issued
   access/refresh tokens across clients in the project for that user's grant. Inventory
   those consumers first, revoke the exposed grant in the approved window, then obtain
   fresh offline authorization with the existing client and scope. Allow for propagation;
   do not revoke the old token after creating its replacement and assume the new one works.
   Update protected operator configuration along with runtime, and verify token/folder
   access privately with aggregate output, without another archive job.
4. Rotate `GOOGLE_DRIVE_ARCHIVE_JOB_SECRET` and `STORE_RESERVATION_CLEANUP_SECRET`
   in both runtime and every runner configuration before restarting/resuming any runner.
   Check private file ownership/modes; an old secret must be rejected. Do not test the
   destructive store-cleanup job through a live cleanup invocation.
5. Coordinate `ZOOM_CLIENT_SECRET`, `ZOOM_MEETING_SDK_CLIENT_SECRET` and
   `ZOOM_WEBHOOK_SECRET` with the corresponding provider apps and runtime. Verify token
   acquisition/read-only metadata, then webhook verification and SDK configuration via
   approved non-mutating/synthetic checks. Provider revocation may invalidate cached or
   in-flight credentials; no meeting or recording delete is part of rotation.
6. Coordinate `LINE_CHANNEL_SECRET`, `SMS_OTP_API_KEY`/`SMS_OTP_API_SECRET`,
   `SLIP_VERIFICATION_API_KEY`, and `PAYMENT_WEBHOOK_SECRET` with their providers and
   all senders/consumers. Validate fresh login, readiness and synthetic signature checks.
   Paid slip verification, OTP sends and payment mutations need their own explicit test
   approval; do not use them as routine health probes.
7. Rotate encrypted-state keys through separately reviewed state-preservation work.
   `GOOGLE_DRIVE_ARCHIVE_SESSION_KEY` decrypts persisted upload capabilities: replacing
   it alone strands resume and cleanup. Inventory non-null sessions by count, preserve
   file IDs/offsets, stop writers, and prepare a guarded per-record old-key/new-key
   re-encryption transaction with round-trip verification and private backup. Do not
   clear mappings or cancel provider sessions as a shortcut. Approval for that data
   rewrite is separate from this diagnostic. `SMS_OTP_CHALLENGE_ENCRYPTION_KEY` likewise
   decrypts pending challenges; pause requests and let the existing ten-minute challenge
   lifetime expire before replacement, or review an exact challenge migration separately.

After each group, verify dependency checks and report only key names, counts and fixed
outcomes. Environment saves may restart Passenger implicitly; record actual saves and
explicit restarts, never assume zero disruption. Restore service by correcting new
credentials or issuing another new credential. Revoked provider secrets/tokens have no
guaranteed rollback, and reintroducing exposed signing keys would restore the exposure.
Encrypted-state rollback must restore matching encrypted rows and key together using
the approved private recovery path; a source-code rollback cannot repair a key mismatch.
Do not restore the entire database just to roll back a credential setting.

Provider references for the approval review:
[Google OAuth security practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices),
[Google token revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke),
[Zoom Server-to-Server app](https://developers.zoom.us/docs/internal-apps/create/),
[LINE channel-secret handling](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/),
and [Plesk database users](https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/website-databases/managing-database-user-accounts.69539/).
Use the database-user operation for this app, not database-administrator credential changes.

## Local corrective MP4 proposal after observed octet-stream (not released)

The observed `application/octet-stream` response motivates a provider-specific,
MP4-only exception with bounded initial format evidence. The shared MIME policy and
strict TXT rule remain unchanged. Missing/unknown MIME and crossed recording metadata
remain rejected. The implementation is prepared locally for review and not released;
production is `ea1386e`. Final verification passed 161 focused tests (one existing
opt-in browser UAT skipped), TypeScript, ESLint and the 67-page Next.js build.

Before accepting binary MIME, require current Zoom metadata `file_size` to be a positive
safe integer exactly equal to the recording's stored size. Require the requested response
to match status200/full size or status206/exact normalized single range and known total,
with exact Content-Length and identity Content-Encoding. No wildcard total, multipart
range, ignored range, header mismatch or unknown size is admitted.

Every binary open then makes a separate authenticated initial range request for
`bytes=0-min(4095,size-1)` to the same freshly retrieved provider URL. This includes
initial archive chunks, one-byte readiness, suffix ranges and resumed nonzero chunks.
No prior verification or durable marker is assumed. Probe status/range/length/encoding
are checked independently; only video/mp4 or octet-stream is allowed for its response.
Its final HTTPS host must still be zoom.us or a subdomain. If either response has an
ETag, both must supply an identical syntactically strong quoted validator. Missing,
mismatched, weak or malformed validators fail closed and cancel both bodies. Neither
response having a validator remains permitted under the documented trusted-source
limitation; this is not a claim of cross-request byte identity.

The probe reads at most 4096 bytes into one fixed buffer, with a ten-second body-read
deadline, exact body length and cancellation on completion/failure. A complete initial
ordinary-size `ftyp` box must start at byte zero, fit the probe and actual file, and have
valid four-byte compatible-brand alignment. Major brands are limited to isom, iso2,
avc1, mp41 and mp42; an explicit mp41/mp42 major or compatible brand is required.
QuickTime, M4A, image brands, generic ISO-only compatibility, HTML/arbitrary prefixes,
truncated/oversized/misaligned boxes and control-byte brands fail closed.
These deliberately conservative limits may reject legitimate uncommon files; they
do not authorize broadening the subset after a failure without evidence/review.

The [MP4 Registration Authority brand registry](https://mp4ra.org/registered-types/brands)
identifies MP4v1/v2 and ISO/AVC brands. The
[W3C ISO BMFF byte stream note](https://www.w3.org/TR/mse-byte-stream-format-isobmff/)
describes initialization beginning with ftyp and moov. This implementation checks only
bounded initial file-type evidence: it does not claim whole-file conformance to that
stream note, decode codecs, locate/validate a tail moov, scan malware, or prove that
every media sample is playable. A hostile payload can forge a valid prefix. Existing
canonical metadata and trusted private Zoom source are still required; the evidence
is a guarded MIME normalization, not validation of an arbitrary uploaded binary.
Same URL/size plus optional ETag comparison is not a cryptographic identity proof across
two requests when no strong validator is available. This tradeoff needs Controller review.

After evidence passes, return normalized video/mp4 through a pull-driven stream that
preserves the requested bytes, checks total emitted length and propagates cancellation.
No tee/eager pump or whole-file buffer is introduced. The probe bytes are discarded,
never prepended to a resumed range, logged or persisted. Rejections cancel the requested
body as well as the probe. The existing archive chunk reader still enforces its 8 MiB
limit; Drive completion size/MIME/parent/privacy/app-binding verification remains intact.
Permissions, bearer token path, download hosts, schema and scheduler are unchanged.

Proposed subsequent controlled acceptance, requiring fresh release/UAT approval:

1. Review/commit the exact scoped fix, verify remote ancestry, deploy/build and restart
   once, then health check. No schema or credential change. Record all actual counts.
2. Run exactly one manual archive step on the existing approved Test/UAT queue without
   resetting leases/attempts/mappings. Report aggregate progress/fixed error only. Stop
   on retry/failed/idle; do not widen brands/hosts, fall back to unverified bytes, or retry
   under this one-run authorization. A progress result does not prove archive completion.
3. If progress succeeds, obtain finite follow-on copy approval based on privately verified
   candidate size and acknowledged offset: remaining chunk steps plus one metadata
   completion verification. Confirm the same candidate/binding before claiming acceptance;
   the current queue may select another eligible recording on a subsequent invocation.
   Exact-target control needs separate review if queue selection cannot demonstrate this.
4. Complete same-file private size/MIME/bytes verification, authorized Doctor/Admin
   view/download/ranges, anonymous/customer/cross-doctor denial, and explicitly bounded
   concurrent/restart recovery checks. Browser media decode/playback and controlled
   byte comparison remain required; synthetic prefixes cannot replace real recording UAT.
   Activate one periodic task only after all acceptance gates pass.

Credential exposure recovery remains separate and unexecuted. No further provider calls,
job invocations, release/restart, scheduler activation or secret rotation occurred while
preparing this local corrective implementation.

### Finite candidate completion gate for Controller review

The current queue endpoint accepts no exact candidate target and returns no candidate
binding. Its findFirst selects any eligible pending/uploading/retry recording ordered
by retry time and creation time. The lease protects a claimed row during one invocation,
not ownership across invocations. A retry becoming eligible, another operator invocation
or an intervening record change can change selection. With several pending recordings,
the current interface therefore cannot guarantee that a finite sequence completes the
same privately selected recording. Do not promise same-file completion from progress
alone or disable/reset other records to force queue selection.

Exact candidate completion is presently blocked on reviewed target affinity and a
private precheck; this proposal does not add that capability. The precheck must verify
the exact eligible Test/UAT candidate, private byte size and durable offset plus current
lease/retry state without exposing identifiers. Before approving copy completion,
review a target-bound runner/claim path (same permissions, canonical metadata and leases)
or evidence that an isolated eligible queue guarantees that binding. Do not infer queue
isolation from an empty scheduler or assume that disabling other recording rows is safe.

Once target affinity is established, propose one cohesive approval with an explicit
finite ceiling `ceil((size - verified_offset) / 8388608) + 1` manual job invocations
(remaining chunks plus one completion metadata verification). Offset must be acknowledged
by the provider; a stale DB offset is not evidence. If only the source size is known,
use the conservative ceiling `ceil(size / 8388608) + 1`, with each job still reconciling
the actual offset. Missing sessions/provider offsets or recovery paths require reviewed
precheck handling; an unexpected session-reset/retry/idle/error stops the batch, not an
automatic expansion of the approved ceiling. No bulk queue drain or unlimited retry is
implied. Record every actual call and stop as soon as exact verified completion occurs.

That same approval should name the same-file private Drive byte comparison and one
Doctor/Admin view/download/range check each, anonymous/customer/cross-doctor denial
checks, and separately bounded concurrency/restart checks with explicit total call/restart
ceilings and expected queue effects. Determine those numbers from the private precheck
and chosen recovery fixture before approval; they are not executable authority yet.
If repeat lease/restart UAT would touch another recording after the candidate completes,
use a separately named Test/UAT fixture rather than silently claiming another queue item.
This groups completion acceptance into a finite operation without repeated per-chunk
approval or abandoning target ownership safeguards.

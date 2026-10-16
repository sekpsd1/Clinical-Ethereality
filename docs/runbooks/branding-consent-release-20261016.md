# Branding and consent popup release 2026-10-16

TASK: Release reviewed branding and Word-matched booking consent popup
STATUS: complete
IMPLEMENTATION: verified
RELEASE: deployed
UAT: partial
BRANCH: codex/clinic-visible-branding
COMMIT: Published/deployed 4fd825434b1ace30bc46179f25ce163555e120a6, including branding fff326506a62599d3f8fd6da1c6f049a5ba2f2c6; local release-documentation commit separate
CHANGED: Root metadata, shared TopAppBar, booking consent field/dialog, exact source content/version and relevant tests; release documentation records evidence only.
CHECKS: Local build 68 pages, lint, TypeScript, diff checks, 1800 unit tests (10 skipped) and 10 Chromium interaction/geometry tests at 320/375px passed. Independent DOCX parity: all 43 non-empty paragraphs in order after paragraph-edge whitespace trimming only; seven sections, zero tables or extra text nodes; normalized paragraph SHA-256 c20253c4298fe8d3ee3de4f9c0fd83f683b3b0998186815c88a649165221fd96. Production preflight, npm ci, isolated Zoom dependency install and build:plesk-host passed; 68 pages and standalone mirror of 138 static/24 public files verified. One explicit restart, zero recovery restarts. Health HTTP200/status ok; /auth/line HTTP200 with exact default title Bangkok Cytogenetics Clinic. /telemedicine-consent HTTP200 with all 43 source paragraphs, version 2026-10-16, unchanged recording disclosure and explicit separation from the source.
APPROVAL SCOPE: Owner explicitly authorized push/deploy of the two reviewed commits to https://app.bccgroup-thailand.com; no business-record creation or consent on behalf of a person.
RESIDUAL STATE: Existing backup entries retained: 2026-10-16 01:11 scheduled backup and 2026-10-09 18:07 full backup (2.69 GB). Source baseline before release: host 6f3596bc8d196d8bd6ff8f782811ad0a8263e6dd; main c51f713ba683f48c377d949715c22599cfd24212 (documentation-only delta). No schema/migration, database rollback, secret/env/provider/LINE-console/scheduler changes. Test screenshots and a public Production screenshot remain in the task visualization directory; no patient data is in those screenshots. Release documentation is committed locally only, not pushed/deployed.
NEXT ACTION / OWNER: Controller16 coordinates authenticated Customer popup/actual LINE-device UAT. Existing browser session routes /consult to Admin; direct booking read reaches /consult/assessment. Stop before accepting assessment/consent or creating booking/payment records until an authorized device/test flow is supplied.
RISKS / FOLLOW-UP: Per-page legal/contact metadata title overrides were outside the reviewed branding scope and remain unchanged. Default inherited document title is verified. No claim of actual LINE-device acceptance or comprehension verification. Existing historical consent rows are not rewritten.
NEEDS PLAN REVIEW: yes

## Release sequence and preservation

Before mutation, the worktree was clean at `4fd8254`, `origin/main` was verified at `c51f713`, and the Plesk commit list showed `6f3596b`. The existing app root `/app.bccgroup-thailand.com`, public root `/app.bccgroup-thailand.com/public`, startup `server.js`, Production mode and Node 24.21.0 were confirmed. Neither migration nor reconciliation approval target was present. No newer remote or host source was overwritten.

Main was fast-forwarded once, with no force push. Plesk Pull showed `4fd8254` and `fff3265`; Deploy Now was executed once. The existing release pattern ran non-migration preflight, clean lockfile install, Zoom-client install and one host build, followed by one explicit App restart. Archive configuration, existing scheduled tasks, credentials and provider settings were not edited.

## Code rollback if separately authorized

The exact previous host source is `6f3596bc8d196d8bd6ff8f782811ad0a8263e6dd`. Main's pre-release baseline `c51f713ba683f48c377d949715c22599cfd24212` has identical product code and only newer cleanup documentation. If no intervening source changes exist, create forward revert commits in reverse order: revert popup `4fd8254`, then branding `fff3265`. Review conflicts if main has advanced; never reset/force-push main. Push the approved rollback and repeat Plesk Pull/Deploy, non-migration preflight, dependency/build steps and one restart, followed by health/title checks. Alternatively, an approved recovery branch pinned to the exact previous host hash can be selected through Plesk's existing Git workflow.

No database restore is needed for this code rollback: this release applied no migration or business-record mutation. Retain historical consent rows, including version `2026-10-16` if bookings are later made under this release. Do not restore the full backup over newer live records merely to undo a UI release.

## Screenshots

Task artifact directory: `C:/Users/WINDOWS 11/.codex/visualizations/2026/09/16/01a0a9e1-37ae-72b3-9705-ed1f9cbd3e0e/`.

- `consent-production-20261016.png`: public deployed consent page, clinic title and current version visible; not the authenticated popup.
- `consent-320-before.png`, `consent-320-after.png`: real local component before/after keyboard scrolling; actions remain outside the scroll body.
- `consent-375-before.png`, `consent-375-after.png`: equivalent local 375px preview.
- `branding-320.png`, `branding-375.png`: local header geometry previews.

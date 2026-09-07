# Test-only LINE Mini App to Zoom validation

This runbook provisions and exercises the isolated Test path at
https://test-app.bccgroup-thailand.com. It does not authorize a Production
change. Never reuse the Production database, database user, LINE channel or
LIFF, Zoom apps or host, JWT secret/issuer, files, patient data, payment data,
or fixture.

The Production command npm run uat:zoom-fixture remains separate. The Test
commands are npm run uat:zoom-test-db-precheck,
npm run uat:zoom-test-account-bootstrap, and npm run uat:zoom-test-fixture.

## 1. Provision the isolated Test boundary

The owner must create a dedicated blank Test database and dedicated database
user. Both names must contain a separate test, uat, or staging token and must
not contain prod, production, main, or app2026. Grant that user access only to
the Test database.

Create dedicated internal Test LINE and Zoom applications:

- LINE Login channel and LIFF endpoint:
  https://test-app.bccgroup-thailand.com
- LINE callback:
  https://test-app.bccgroup-thailand.com/api/auth/line/callback
- Meeting SDK and Server-to-Server OAuth apps, licensed Test host, and webhook
  secret that are not used by Production
- Zoom webhook endpoint:
  https://test-app.bccgroup-thailand.com/api/webhooks/zoom

Creating accounts/credentials and entering secrets transmits sensitive access
data. The operator must obtain action-time confirmation immediately before each
creation or credential-entry action. Never put a secret in a command,
screenshot, chat, issue, source file, or browser storage.

Copy the key names from .env.staging.example into the Test site's private Plesk
environment. Keep NODE_ENV=production, CE_DEPLOYMENT_ENVIRONMENT=test,
ENABLE_DEV_AUTH_BYPASS=false, and the exact Test URLs. Leave
PLESK_MIGRATION_TARGET and every reconciliation target entirely absent,
including empty values. Leave payment, SMS, community, AI, prescription,
Cloudinary/S3, and upload integrations disabled/empty for this Zoom-only run.

Set ZOOM_TEST_LINE_CREDENTIALS_CONFIRMED=true and
ZOOM_TEST_ZOOM_CREDENTIALS_CONFIRMED=true only after a second person or the
owner verifies the Test applications are separate from Production.

## 2. Prove the blank Test database before migration

The read-only pre-migration guard queries only DATABASE() and CURRENT_USER()
from the connected database. It intentionally does not require application
tables, Test users, LINE credentials, or Zoom credentials, so it can run
against the dedicated blank database. Set ZOOM_TEST_DATABASE_IDENTITY_SHA256
to the lowercase SHA-256 of:

    <exact database name><NUL><exact CURRENT_USER() result>

Calculate the digest in a private local tool. Do not print either input or the
digest in Plesk logs or chat. A hash match is insufficient by itself: both live
database identities must contain a separate test, uat, or staging token and
must not contain prod, production, main, or app2026.

Run this mandatory guard immediately before migrations:

    run uat:zoom-test-db-precheck -- --confirm-test

Continue only when it returns databaseIdentity matched. Then apply repository
migrations through the reviewed staging migration procedure:

    run db:migrate:deploy

Some Plesk versions do not inject Node App custom environment variables into
the Node command runner. If the command above returns
`ENVIRONMENT_NOT_PRODUCTION` while the Node App Dashboard still shows
production mode, do not copy credentials into the command or a file. Use the
guarded application-runtime path instead:

1. Deploy the reviewed source containing the Test runtime runner.
2. Add the one-time Node App variable
   `ZOOM_TEST_PLESK_MIGRATION_ACTION=preflight-and-deploy-v1`.
3. Restart only the Test Node App and make one request to the Test origin.
4. Run `check:zoom-test-plesk-migration-status` without arguments. Continue
   only when the safe result is `complete` / `complete` / `READY`.
5. Remove `ZOOM_TEST_PLESK_MIGRATION_ACTION` entirely before the normal build
   and restart.

The runtime path calls the same database identity preflight, runs `prisma
migrate deploy`, verifies `prisma migrate status`, writes only an allowlisted
private status artifact, and deliberately refuses to start the web app while
the one-time action exists. It never logs database identity, credentials, or
Prisma output.

Do not use prisma db push or prisma db seed. Keep every migration and
reconciliation target key absent during both commands. If any Test boundary
cannot be proven, stop without migrating.

## 3. Bootstrap the two LINE-backed Test accounts

Sign in once through the dedicated Test LIFF with two distinct synthetic LINE
accounts. Do not manually complete a profile, approve a Doctor, or copy LINE
IDs, names, email addresses, phone numbers, or database IDs into a command.
Set only the private lowercase SHA-256 digests of each internal User.id in
ZOOM_TEST_CUSTOMER_USER_ID_SHA256 and ZOOM_TEST_DOCTOR_USER_ID_SHA256.

Each digest must resolve to exactly one active LINE-backed account in untouched
Customer state, with no Consultation, Payment, Order, Prescription, or
Notification. Keep SMS, payments, storage, uploads, community, AI, booking,
patient portal, and prescriptions disabled. The runner never contacts LINE,
SMS, Zoom, storage, payment, or another provider.

Precheck is read-only and returns a target fingerprint:

    run uat:zoom-test-account-bootstrap -- --mode=precheck --confirm-test

Apply requires that exact fingerprint and runs in a Serializable transaction:

    run uat:zoom-test-account-bootstrap -- --mode=apply --confirm-test --target-fingerprint=<fingerprint>

It gives the Customer a clearly synthetic, non-routable Test-only profile and
verified-phone marker without sending SMS. It promotes only the second Test
account to Doctor, creates one approved Test-only Doctor profile with no
license number or phone, and appends exactly two Test-only provenance audits.
An exact replay performs no mutation; any partial state, unexpected profile,
related business record, audit mismatch, or changed fingerprint fails closed.

Verify read-only after apply:

    run uat:zoom-test-account-bootstrap -- --mode=verify --confirm-test --target-fingerprint=<fingerprint>

These identities and their synthetic data are permanently Test-only. Never
copy, promote, restore, or synchronize them into Production. The fixture
runner independently rechecks the database identity, complete migrations,
schema columns, and both account hashes without printing identity data.

## 4. Deploy and smoke-test the Test site

Deploy only the reviewed `codex/test-zoom-fixture` branch to the Test site by
using the Plesk Git panel's manual Pull/Deploy controls. Do not merge this
branch into `main` for this validation, do not use automatic deployment, and
do not run Pull/Deploy for the Production site. Use deterministic lockfiles,
approved Node 24.x, the configured public document root, and server.js. Run the
non-migration preflight, build the root and isolated Zoom client, prepare the
Plesk host runtime, and restart only the Test application.

Stop if health/auth fails, a migration is unfinished or unexpected, a secret
appears, or any boundary cannot be proven. Required smoke checks:

- /api/health returns HTTP 200 and status ok
- /auth/line uses the Test LIFF
- anonymous protected routes redirect to Test LINE login
- Zoom CSP is present only on /zoom-sdk/*

## 5. Create the controlled fixture

Choose a unique non-sensitive fixture key and a future UTC slot no more than
30 days away. In Plesk's Node command UI, enter only the portion after the
automatic npm prefix and confirm the rendered command.

Precheck:

    run uat:zoom-test-fixture -- --mode=precheck --confirm-test --fixture-key=<key> --scheduled-at=<ISO-UTC>

The successful result contains a fingerprint. Keep it private. Creation
requires that exact fingerprint:

    run uat:zoom-test-fixture -- --mode=create --confirm-test --fixture-key=<key> --scheduled-at=<ISO-UTC> --target-fingerprint=<fingerprint>

Create runs in a Serializable transaction and creates only one 30-minute
scheduled Consultation plus one Test-only AuditLog. Replaying the exact command
returns the same state without a second mutation. It never creates a Payment,
slip, Order, Prescription, SMS/provider request, attendance record, or Zoom
meeting.

## 6. Run mobile LINE and Zoom UAT

At the slot time, the assigned Doctor starts the Consultation once through the
normal Test UI. Confirm exactly one Zoom meeting. The Customer then opens the
same Consultation from the LINE Mini App.

Immediately before accepting browser camera/microphone permissions, obtain the
operator's action-time confirmation for the specific Test device and Test
origin. Verify:

- LINE opens the same-origin Zoom client in the external browser.
- The fragment ticket disappears after exchange, fails on reuse, expires
  unused after two minutes, and does not create a general app session.
- Denying either camera or microphone keeps Join disabled.
- Allowing both stops temporary preflight tracks before join data is requested.
- Customer and Doctor enter the same meeting; a wrong account/role is denied.
- Page open and media preflight alone do not count as attendance.

Do not retry after an uncertain LINE/Zoom result. Stop and report the closed
status category first.

Read-only verification after the Doctor starts the room:

    run uat:zoom-test-fixture -- --mode=verify --confirm-test --fixture-key=<key> --scheduled-at=<ISO-UTC> --target-fingerprint=<fingerprint> --expected-status=live --expected-zoom=present

## 7. Non-destructive cleanup

End/leave the Test meeting, then cancel only the exact fixture:

    run uat:zoom-test-fixture -- --mode=cleanup --confirm-test --fixture-key=<key> --scheduled-at=<ISO-UTC> --target-fingerprint=<fingerprint>

Cleanup changes only that Consultation's status to cancelled and appends one
Test-only AuditLog. It does not delete records, clear Zoom evidence, or call
Zoom. Replaying cleanup is read-only and returns replayed: true.

Verify the cancelled fixture:

    run uat:zoom-test-fixture -- --mode=verify --confirm-test --fixture-key=<key> --scheduled-at=<ISO-UTC> --target-fingerprint=<fingerprint> --expected-status=cancelled --expected-zoom=present

Record only pass/fail, closed status/error codes, HTTP categories, and aggregate
counts. Never record the fixture key, fingerprint, identifiers, credentials,
meeting data, webhook payload, or personal data in a handoff.

# Test-only LINE Mini App to Zoom validation

This runbook provisions and exercises the isolated Test path at
https://test-app.bccgroup-thailand.com. It does not authorize a Production
change. Never reuse the Production database, database user, LINE channel or
LIFF, Zoom apps or host, JWT secret/issuer, files, patient data, payment data,
or fixture.

The Production command npm run uat:zoom-fixture remains separate. The Test
command is npm run uat:zoom-test-fixture.

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

## 2. Prepare the database and account digests

Apply repository migrations to the blank Test database through the reviewed
staging migration procedure. Do not use prisma db push. Before mutation, the
runner compares every successfully applied, non-rolled-back migration with the
source migration directories and checks the required schema columns.

The runner queries DATABASE() and CURRENT_USER() from the connected database.
Set ZOOM_TEST_DATABASE_IDENTITY_SHA256 to the lowercase SHA-256 of:

    <exact database name><NUL><exact CURRENT_USER() result>

Calculate the digest in a private local tool. Do not print either input or the
digest in Plesk logs or chat. The runner reports only matched or a closed
failure code. A hash match is insufficient by itself: both live database
identities must contain a Test token and must not look like Production.

Sign in once through the dedicated Test LIFF with the synthetic Customer and
Doctor LINE accounts. Approve the Doctor in Test and complete the Customer's
synthetic profile/phone verification through the approved Test path. Do not
copy LINE IDs, names, email addresses, phone numbers, or database IDs into a
command.

Set these private environment digests:

- ZOOM_TEST_CUSTOMER_USER_ID_SHA256: lowercase SHA-256 of the Test Customer's
  internal User.id
- ZOOM_TEST_DOCTOR_USER_ID_SHA256: lowercase SHA-256 of the Test Doctor's
  linked internal User.id

The runner searches only LINE-backed database accounts and requires exactly
one active, verified Customer and one active Doctor with an approved profile.
It never prints their IDs, LINE identities, labels, or profile data.

## 3. Deploy and smoke-test the Test site

Use reviewed origin/main source, deterministic lockfiles, approved Node 24.x,
public document root, and server.js. Run the non-migration preflight, build the
root and isolated Zoom client, prepare the Plesk host runtime, and restart only
the Test application.

Stop if health/auth fails, a migration is unfinished or unexpected, a secret
appears, or any boundary cannot be proven. Required smoke checks:

- /api/health returns HTTP 200 and status ok
- /auth/line uses the Test LIFF
- anonymous protected routes redirect to Test LINE login
- Zoom CSP is present only on /zoom-sdk/*

## 4. Create the controlled fixture

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

## 5. Run mobile LINE and Zoom UAT

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

## 6. Non-destructive cleanup

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

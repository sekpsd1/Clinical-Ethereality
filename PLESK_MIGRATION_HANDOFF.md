# Plesk Migration Handoff

This handoff records the current hosting status and the first-run checklist for moving Clinical Ethereality from the temporary cPanel proof-of-run environment to the new Plesk hosting plan.

Do not commit real database passwords, LINE secrets, PromptPay identifiers, bank details, license numbers, API keys, uploaded documents, or patient-like data.

## Current Hosting Status

The temporary cPanel deployment proved that the standalone Next.js application can run on shared hosting when Node.js is available. The active hosted test environment is now Plesk at `https://app.bccgroup-thailand.com`.

Verified on the temporary cPanel host:

- `GET /api/health` returned `{"status":"ok","service":"clinical-ethereality"}`.
- `/auth/line` redirected to the LINE Login screen after the LIFF ID was included in the production build.
- MySQL schema import through phpMyAdmin completed successfully after Prisma CLI commands were unreliable on the shared cPanel limits.
- The cPanel plan hit CloudLinux CPU/process/I/O limits during package install, Prisma, and environment-save operations.

Decision:

- Treat the cPanel host as a proof-of-run only.
- Use Plesk for hosted UAT. HTTPS, MySQL schema, `/api/health`, Git pull/deploy, and Node.js startup are working.
- Keep Git deployment manual until all hosted UAT checks pass. Build through the Plesk Node.js command panel because this host's Git deployment shell does not expose npm correctly.

## Plesk Host Requirements

Confirm these before the first deploy:

- Node.js app support is enabled.
- Node.js `24.18.0` is selectable and active on the hosted application.
- App mode can be set to `production`.
- Startup file can be set to `server.js`.
- Environment variables can be added without exposing values publicly.
- MySQL or MariaDB database can be created with a dedicated user.
- SSL is active for the app subdomain.
- App restart is available from the Plesk panel.
- SSH or terminal access is available, or the panel can run `npm install` reliably.

Recommended app URL:

```text
https://app.bccgroup-thailand.com
```

## First Plesk App Settings

Use these values unless the new host requires a different folder layout:

```text
Node.js version: 24.18.0
Application mode: production
Application root: app.bccgroup-thailand.com application folder
Document root: public
Startup file: server.js
Application URL: https://app.bccgroup-thailand.com
```

If the Plesk UI has separate "application root" and "document root" fields, keep `server.js`, `.next`, `public`, and `package.json` together in the application root, and set the document root to `public`.

## Environment Variables To Add In Plesk

Required for hosted testing:

```text
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=Clinical Ethereality
NEXT_PUBLIC_APP_URL=https://app.bccgroup-thailand.com
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=<secure random secret>
JWT_ISSUER=clinical-ethereality
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_TTL=30d
ENABLE_DEV_AUTH_BYPASS=false
NEXT_PUBLIC_LINE_LIFF_ID=<LINE LIFF ID>
LINE_CHANNEL_ID=<LINE Login channel ID>
LINE_CHANNEL_SECRET=<LINE Login channel secret>
LINE_LOGIN_CALLBACK_URL=https://app.bccgroup-thailand.com/api/auth/line/callback
STAFF_UPLOAD_DIR=<absolute private writable directory outside application root>
```

Add these only when each integration is ready:

```text
THAI_QR_PROMPTPAY_ID=<production PromptPay ID>
SLIP_VERIFICATION_PROVIDER=easyslip
SLIP_VERIFICATION_API_URL=<provider URL>
SLIP_VERIFICATION_API_KEY=<provider API key>
PAYMENT_WEBHOOK_SECRET=<random webhook secret>
CLOUDINARY_* or S3_* storage variables
ZOOM_* variables
SENTRY_* variables
```

Keep real values only in Plesk or an approved secret manager.

`STAFF_UPLOAD_DIR` is required for temporary host-based staff profile and license
uploads. Create it outside the Git deployment/application root, do not expose it
as a document root, and grant read/write access only to the Plesk Node.js system
user. Profile photos are served through the app; license proofs are restricted to
authenticated admins.

## LINE Developer Settings

Before testing LINE login on Plesk, confirm:

- The LINE Login channel has web login enabled.
- Callback URL includes:

```text
https://app.bccgroup-thailand.com/api/auth/line/callback
```

- LIFF endpoint URL is:

```text
https://app.bccgroup-thailand.com
```

- Required scopes include `openid` and `profile`.
- The test LINE accounts can access the channel if the channel remains in developing mode.

## Build And Upload Workflow

Build on the developer machine, then upload the prepared standalone artifact to Plesk.

```powershell
cd C:\Projects\clinical-ethereality
npm run build:plesk
```

Upload this file or its extracted contents:

```text
C:\Projects\clinical-ethereality\deploy\plesk\server.zip
```

The Plesk application root should contain:

```text
server.js
package.json
.next/
public/
```

Do not upload `.env.local` or `.env.production.local`.

## Database First Run

Preferred:

1. Create the database and user in Plesk.
2. Add the production `DATABASE_URL` in Plesk environment variables.
3. Run the controlled Prisma schema step only after a backup point exists:

```bash
npx prisma db push --schema=prisma/schema.prisma
```

Fallback if shared hosting blocks Prisma CLI:

1. Generate a schema SQL file from a safe local/staging environment.
2. Review it for Prisma comments or invalid SQL wrappers.
3. Import through phpMyAdmin.
4. Confirm the expected tables exist before testing app flows.

Do not import real patient, license, payment, or prescription data for the first hosted test.

## First Hosted Smoke Checks

After starting or restarting the Plesk Node.js app:

1. Open `https://app.bccgroup-thailand.com/api/health`.
2. Confirm `status` is `ok`.
3. Open `https://app.bccgroup-thailand.com/auth/line`.
4. Confirm it redirects to LINE Login, not "LIFF is not configured".
5. Log in with a test LINE account.
6. Confirm customer entry reaches the assessment or consult flow.
7. Open `/admin`, `/doctor`, and `/pharmacist` while logged out and confirm protected data is not exposed.
8. Use `PLESK_TEAM_TESTING_GUIDE.md` for full remote QA after smoke checks pass.

## Do Not Repeat From cPanel

Avoid these on the new Plesk host unless necessary:

- Repeated `npm install` while resource limits are active.
- Repeated Prisma CLI runs after a command appears stuck.
- Pasting secrets into repo files or screenshots.
- Enabling `ENABLE_DEV_AUTH_BYPASS=true` on a public URL.
- Using real patient-like data before backup, access control, and testing sign-off are complete.

## Current Blockers Before Full Hosted QA

- Deploy the current Git `main` build, which reads the LIFF ID at runtime, then verify LINE LIFF login on a mobile device.
- Approve dedicated LINE test accounts for doctor, admin, and pharmacist if that role is retained for MVP fulfillment.
- EasySlip, Zoom, and Cloudinary/S3 credentials remain owner-managed. Staff
  profile and license uploads can use the temporary private Plesk directory while
  broader payment, prescription, and attachment storage still needs the selected
  object-storage provider.
- FDA numbers remain pending from the client.

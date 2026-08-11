# Plesk Node.js Deployment Runbook

This runbook is for hosting Clinical Ethereality on a Plesk plan that has the Node.js application feature enabled. Use this only when Plesk can run a persistent Node.js app. If Node.js is unavailable, use Vercel or a VPS instead.

Do not commit production secrets. Put real values only in Plesk environment variables or the approved secret manager.

For the current move from the temporary cPanel proof-of-run host to the new Plesk host, start with `PLESK_MIGRATION_HANDOFF.md`, then use this runbook for the detailed deploy procedure.

## Required Plesk Capability

- Node.js application menu is available for the domain.
- Node.js 24.x LTS is selectable. Use the currently hosted version `24.18.0`.
- The app can run a persistent startup file.
- The app can run `npm install` and `npm run build`.
- Custom environment variables can be configured.
- MySQL or MariaDB credentials are available for Prisma.
- SSL/TLS is enabled for the production domain.

## Recommended Plesk Settings

- Node.js version: `24.18.0`
- Package manager: `npm`
- Application mode: `production`
- Application root: the folder containing the deployed application files
- Document root: `public`
- Application startup file: `server.js`
- Application URL: the production app URL, for example `https://app.example.com`

For a standalone Next.js deployment, `server.js` is produced by `npm run build` under `.next/standalone/server.js`. Deploy the standalone output so that Plesk's application root contains:

- `server.js`
- `.next/static`
- `public`
- `package.json`
- `node_modules`, copied from the `deploy/plesk` build artifact

## Environment Variables

Use `.env.production.example` as the checklist. In Plesk, set real values in the Node.js environment variable panel.

Required before production testing:

- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ISSUER`
- `JWT_ACCESS_TOKEN_TTL`
- `JWT_REFRESH_TOKEN_TTL`
- `ENABLE_DEV_AUTH_BYPASS=false`
- `NEXT_PUBLIC_LINE_LIFF_ID`
- `LINE_CHANNEL_ID`
- `LINE_CHANNEL_SECRET`
- `LINE_LOGIN_CALLBACK_URL`
- `STAFF_UPLOAD_DIR` set to an absolute writable directory outside the application root
- `PLESK_MIGRATION_TARGET` must be absent for the current non-migration Zoom release, including an empty value

Required only when each integration is enabled:

- Payments: `THAI_QR_PROMPTPAY_ID`, `SLIP_VERIFICATION_PROVIDER`, `SLIP_VERIFICATION_API_KEY`, provider-specific keys such as `SLIPOK_BRANCH_ID`, and `PAYMENT_WEBHOOK_SECRET`
- Storage: Cloudinary or S3-compatible keys
- Video: Zoom SDK and webhook keys
- Monitoring: Sentry DSNs and optional source-map upload keys

Create `STAFF_UPLOAD_DIR` as a private persistent directory that is not served by
Apache/nginx and is not replaced by Git deployment. The Plesk Node.js system user
must be able to read and write this directory. Staff profile photos are delivered
through an application route; license proofs require an authenticated admin
session and are never served directly from the document root.

Never paste actual PromptPay, bank, tax, license, LINE, Zoom, storage, payment, database, or JWT secret values into repo files or screenshots.

## Build Workflow

Run locally or in a clean deployment workspace:

```bash
npm install
npx prisma generate
npx prisma validate
npm run typecheck
npm run lint
npm run test:unit
npm run build:plesk
```

The build must create `.next/standalone/server.js` and prepare `deploy/plesk`. The
artifact includes Prisma engines for both common Plesk Linux families (Debian and
RHEL/AlmaLinux), so do not replace its `node_modules` with a Windows-only install.
Protected-route middleware runs on the Next.js Node.js runtime so JWT validation
uses the same Plesk environment variables as the authentication route handlers.

## Owner Inputs Before Dry Run

Collect these values from the hosting owner before the first Plesk dry run. Store real values only in Plesk or a secure secret channel.

- Production domain or subdomain, for example `https://app.example.com`
- Plesk application root path
- Plesk document root path
- MySQL host, port, database name, username, and password
- SSL status for the production domain
- LINE LIFF production channel values, if login will be tested on the hosted URL
- PromptPay identifier and payment provider values, if payment verification will be tested
- Storage provider choice, either Cloudinary or S3-compatible storage, if uploads will be tested
- Zoom SDK values, if video consultation will be tested
- Sentry values, if production monitoring will be tested

Do not use real patient data, real prescription files, real license documents, or real payment slips during the first dry run.

## Local Plesk Artifact Dry Run

Run this on the developer machine before uploading to Plesk:

```bash
npm install
npx prisma generate
npx prisma validate
npm run typecheck
npm run lint
npm run test:unit
npm run build:plesk
```

Confirm these files exist before uploading:

- `deploy/plesk/server.js`
- `deploy/plesk/package.json`
- `deploy/plesk/.next/static`
- `deploy/plesk/public`

Optional local artifact check:

```bash
cd deploy/plesk
NODE_ENV=production PORT=3001 node server.js
```

Then visit `http://localhost:3001/api/health`. Stop this local artifact server before returning to `npm run dev`.

## Standalone Artifact Copy

If Plesk expects `server.js` at the application root, prepare the standalone output with:

```bash
npm run build:plesk
```

The script copies `.next/standalone`, `.next/static`, and `public` into `deploy/plesk`, then verifies that `server.js`, `package.json`, `.next/static`, and `public` exist. Upload the contents of `deploy/plesk` to the Plesk application root. Keep `.next/static` and `public` beside the standalone server.

When packaging on Windows for extraction by Plesk/Linux, create the archive with
POSIX path separators. PowerShell `Compress-Archive` can produce backslash paths
that Plesk's `unzip` rejects.

## GitHub Deployment

Plesk can pull the private GitHub repository and run deployment actions after the
source files are published. Configure the repository in **manual deployment** mode
first, then switch to automatic deployment only after a successful hosted smoke test.

1. In Plesk, open **Websites & Domains > app subdomain > Git > Add Repository**.
2. Choose **Remote Git hosting**, branch `main`, and the GitHub repository URL.
3. Use Plesk's generated SSH public key as a GitHub deploy key with read-only access.
4. Set the deployment target to the Node.js application root.
5. Start with **manual deployment**. On the current host, do **not** enable
   additional deployment actions: its non-interactive Git shell does not expose
   the selected Node.js runtime and fails with `nodenv: npm: command not found`.
6. Click **Pull Now**, then **Deploy Now**.
7. Open **Node.js > Run Node.js commands**, select Node.js `24.18.0` and npm,
   then run these commands one at a time:

```bash
npm run preflight:plesk:non-migration
npm ci --include=dev --no-audit --no-fund
npm --prefix zoom-client ci --include=dev --no-audit --no-fund
npm --prefix zoom-client run build
npm run build:plesk-host
```

8. Keep the Node.js startup file as `server.js` and document root as `public`.
9. Click **Restart App** in the Node.js screen.

`npm ci` is expected to pass with the current committed `package-lock.json`.
If it reports a lock-file mismatch, click **Pull Now** and **Deploy Now** again
before retrying; do not run an ad-hoc `npm install` on the server. `build:plesk-host`
builds on Linux and copies required static/public files into
`.next/standalone`; the committed root `server.js` then starts that standalone app.
Do not add `prisma db push` to deployment actions. Apply production schema
changes separately with a reviewed backup and migration procedure.

### Non-migration preflight and scoped Zoom CSP

For the Zoom Meeting SDK release, `PLESK_MIGRATION_TARGET` must be **absent**
(including an empty value) before the build or restart. Run
`npm run preflight:plesk:non-migration` first. It exits non-zero and logs only
the key name when the key exists; it never prints its value. `server.js` runs
the same guard before it can call the runtime migration runner, so the app fails
closed rather than running a migration.

The Zoom Meeting SDK CSP is defined in `next.config.ts` and applies only to
`/zoom-sdk/:path*`, including static files served from `public/zoom-sdk/` in the
standalone app. Do not set this policy in Plesk's global additional-header UI:
that would weaken CSP for unrelated application paths. After an approved deploy,
verify `Content-Security-Policy` on `/zoom-sdk/index.html` and confirm that it
is absent from an unrelated application route.

### Controlled Zoom UAT fixture runner

`npm run uat:zoom-fixture` is a one-off, approval-gated Production runner. It
is not a deployment action and must never run from startup, build, or migration
work. It has only `precheck`, `create`, `verify`, and `cleanup` modes. Each
invocation requires `--confirm-production`, the exact approved Customer and
Doctor labels, a future UTC slot, a unique fixture key, and (after precheck)
the returned target fingerprint. It masks internal identifiers and never prints
environment values, tokens, or Zoom data.

In Plesk's command UI, enter only the portion after its automatically added
`npm` prefix, confirm the rendered command is `npm run uat:zoom-fixture -- ...`,
and run one approved mode at a time. `create` is a Serializable transaction that
creates only a 30-minute scheduled `[UAT]` Consultation and AuditLog. It refuses
duplicate keys, non-unique or ineligible accounts, occupied slots, and related
Payment, payment-slip attachment, Order, or Prescription state. `cleanup`
changes only that exact fixture to `cancelled` and appends AuditLog; it never
deletes records or modifies Zoom through the database.

Production use requires a separately approved source deployment and separately
approved controlled UAT. Do not put fixture identifiers, keys, fingerprints, or
command output in public tickets or chat transcripts.

### Guarded Plesk runtime migrations

The root `server.js` retains the reviewed migration runner, but the current
non-migration startup guard blocks it whenever `PLESK_MIGRATION_TARGET` exists.
Do not set that key for this release. A future migration requires a separately
approved source change that replaces this guard with a migration-specific,
reviewed deployment procedure.

Never put `DATABASE_URL` in a command, command history, temporary `.env` file,
source file, or documentation, and do not use `prisma db push`.

## Plesk Start And Restart

In Plesk:

1. Open the domain's Node.js page.
2. Set Node.js version to `24.18.0`.
3. Set application mode to `production`.
4. Set startup file to `server.js`.
5. Confirm environment variables.
6. Do not click `NPM install` after uploading this standalone artifact; its
   production dependencies and Linux Prisma engine are already included.
7. Click `Restart App`.
8. Visit `/api/health`.

Expected health response:

```json
{"status":"ok","service":"clinical-ethereality"}
```

## Plesk Dry-Run Checklist

Use this for the first hosted dry run before any real launch.

1. Create or select the production subdomain in Plesk.
2. Enable SSL/TLS for the domain before testing login callbacks.
3. Open the Node.js page and select Node.js `24.18.0`.
4. Set application mode to `production`.
5. Set document root to `public`.
6. Set startup file to `server.js`.
7. Upload the contents of `deploy/plesk` into the application root.
8. Add environment variables from `.env.production.example` with real values only in Plesk.
9. Create the private staff upload directory outside the application root, set
   `STAFF_UPLOAD_DIR` to its absolute path, and confirm the Node.js user can write
   to it.
10. Confirm `ENABLE_DEV_AUTH_BYPASS=false`.
11. Keep the `node_modules` folder from the artifact. Do not run `NPM install` in
    Plesk unless the deployment procedure has also explicitly provided the Prisma
    schema and a Linux-side `prisma generate` step.
12. Restart the app.
13. Open `/api/health`.
14. Open `/auth/line` and confirm the page loads.
15. Open `/admin`, `/doctor`, and `/pharmacist` while logged out and confirm protected routes do not expose data.
16. Submit synthetic staff profile and license files, verify that only an admin
    can open the license proof, and confirm that a Git deploy does not remove the
    uploaded files.
17. Record any Plesk build, startup, memory, or permission errors before changing code.

If the app fails to start, check these in order:

- `server.js` exists at the application root.
- `.next/static` and `public` are beside `server.js`.
- `DATABASE_URL` is reachable from the Plesk server.
- `JWT_SECRET` is set and at least 32 characters.
- `NEXT_PUBLIC_APP_URL` matches the hosted URL.
- `LINE_LOGIN_CALLBACK_URL` matches the hosted callback URL.
- In LINE Developers, the LINE Login callback URL is exactly `https://app.bccgroup-thailand.com/api/auth/line/callback` for the current hosted app.
- Node.js version is `24.18.0` or another approved Node.js LTS version.
- Plesk logs do not show missing package, permission, or memory errors.

## Database Workflow

- Use production MySQL/MariaDB only for production.
- Do not seed synthetic demo records into production.
- Run schema changes only after a backup is confirmed.
- On Shared Plesk, use the reviewed guarded runtime runner only for an approved
  migration target; do not invoke Prisma directly from an ad-hoc shell command.
- Until formal Prisma migrations are finalized, treat `prisma db push` as a controlled release step and do not run it casually against production.
- Confirm `npx prisma validate` before deployment.

## Post-Deploy Checks

- `GET /api/health` returns `ok`.
- `/auth/line` loads.
- Open `https://app.bccgroup-thailand.com/auth/line?next=%2Fadmin` from a desktop browser. It must complete LINE Login once and return to `/admin` for an approved admin account; it must not loop back to the LINE Login screen.
- Customer routes redirect unauthenticated users to LINE auth.
- `/admin`, `/doctor`, and `/pharmacist` enforce role boundaries.
- `ENABLE_DEV_AUTH_BYPASS` is false.
- PromptPay and slip verification show configured/not-configured states without exposing real values.
- Sentry or approved monitoring is receiving non-sensitive test events, if enabled.

## Hosted Smoke Test Checklist

After the Plesk dry run is healthy, test only with synthetic data:

- Customer auth entry loads at `/auth/line`.
- Customer assessment flow loads from `/consult/assessment`.
- Doctor list loads at `/consult`.
- Booking page loads at `/consult/booking/somchai`.
- Appointment detail page hides protected data from the wrong role.
- Doctor queue loads for a doctor account.
- Doctor patient log shows assessment summary without raw LINE IDs.
- Admin payment review loads without exposing secret values.
- Store, cart, order tracking, and prescription-required purchase paths load.
- External prescription attachment flow stores metadata only and does not store file bytes in MySQL.
- Admin integration readiness reports configured/missing keys without showing secret values.

For the full remote QA checklist after Plesk deployment, use `PLESK_TEAM_TESTING_GUIDE.md`.

## Rollback

1. Keep the previous standalone artifact or Plesk backup before deployment.
2. If the new deployment fails, restore the previous application folder.
3. Restart the Node.js app in Plesk.
4. Check `/api/health`.
5. If a database change was applied, follow `BACKUPS.md` and the approved restore or forward-fix plan.

## When To Prefer VPS Or Vercel

Use Vercel or a VPS instead of Plesk if:

- Plesk cannot run a persistent Node.js process.
- The hosting plan cannot choose an approved Node.js LTS version.
- Build memory is too low for `npm run build`.
- File permissions block `.next/standalone` or `.next/static`.
- The team needs SSH-level control for queues, cron, or custom process supervision.

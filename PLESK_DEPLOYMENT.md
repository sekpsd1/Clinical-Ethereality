# Plesk Node.js Deployment Runbook

This runbook is for hosting Clinical Ethereality on a Plesk plan that has the Node.js application feature enabled. Use this only when Plesk can run a persistent Node.js app. If Node.js is unavailable, use Vercel or a VPS instead.

Do not commit production secrets. Put real values only in Plesk environment variables or the approved secret manager.

## Required Plesk Capability

- Node.js application menu is available for the domain.
- Node.js 20.x LTS is selectable. Use `20.20.2` from the currently available HostAtom/Plesk list.
- The app can run a persistent startup file.
- The app can run `npm install` and `npm run build`.
- Custom environment variables can be configured.
- MySQL or MariaDB credentials are available for Prisma.
- SSL/TLS is enabled for the production domain.

## Recommended Plesk Settings

- Node.js version: `20.20.2`
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
- `node_modules`, installed by Plesk or copied from the build artifact

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

Required only when each integration is enabled:

- Payments: `THAI_QR_PROMPTPAY_ID`, `SLIP_VERIFICATION_PROVIDER`, `SLIP_VERIFICATION_API_KEY`, provider-specific keys such as `SLIPOK_BRANCH_ID`, and `PAYMENT_WEBHOOK_SECRET`
- Storage: Cloudinary or S3-compatible keys
- Video: Zoom SDK and webhook keys
- Monitoring: Sentry DSNs and optional source-map upload keys

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

The build must create `.next/standalone/server.js` and prepare `deploy/plesk`.

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

## Plesk Start And Restart

In Plesk:

1. Open the domain's Node.js page.
2. Set Node.js version to `20.20.2`.
3. Set application mode to `production`.
4. Set startup file to `server.js`.
5. Confirm environment variables.
6. Click `NPM install` if dependencies are not already installed.
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
3. Open the Node.js page and select Node.js `20.20.2`.
4. Set application mode to `production`.
5. Set document root to `public`.
6. Set startup file to `server.js`.
7. Upload the contents of `deploy/plesk` into the application root.
8. Add environment variables from `.env.production.example` with real values only in Plesk.
9. Confirm `ENABLE_DEV_AUTH_BYPASS=false`.
10. Run `NPM install` in Plesk if `node_modules` is not uploaded with the artifact.
11. Restart the app.
12. Open `/api/health`.
13. Open `/auth/line` and confirm the page loads.
14. Open `/admin`, `/doctor`, and `/pharmacist` while logged out and confirm protected routes do not expose data.
15. Record any Plesk build, startup, memory, or permission errors before changing code.

If the app fails to start, check these in order:

- `server.js` exists at the application root.
- `.next/static` and `public` are beside `server.js`.
- `DATABASE_URL` is reachable from the Plesk server.
- `JWT_SECRET` is set and at least 32 characters.
- `NEXT_PUBLIC_APP_URL` matches the hosted URL.
- `LINE_LOGIN_CALLBACK_URL` matches the hosted callback URL.
- Node.js version is `20.20.2` or another supported Node.js 20 LTS version.
- Plesk logs do not show missing package, permission, or memory errors.

## Database Workflow

- Use production MySQL/MariaDB only for production.
- Do not seed synthetic demo records into production.
- Run schema changes only after a backup is confirmed.
- Until formal Prisma migrations are finalized, treat `prisma db push` as a controlled release step and do not run it casually against production.
- Confirm `npx prisma validate` before deployment.

## Post-Deploy Checks

- `GET /api/health` returns `ok`.
- `/auth/line` loads.
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

## Rollback

1. Keep the previous standalone artifact or Plesk backup before deployment.
2. If the new deployment fails, restore the previous application folder.
3. Restart the Node.js app in Plesk.
4. Check `/api/health`.
5. If a database change was applied, follow `BACKUPS.md` and the approved restore or forward-fix plan.

## When To Prefer VPS Or Vercel

Use Vercel or a VPS instead of Plesk if:

- Plesk cannot run a persistent Node.js process.
- The hosting plan cannot choose Node.js 20.x LTS.
- Build memory is too low for `npm run build`.
- File permissions block `.next/standalone` or `.next/static`.
- The team needs SSH-level control for queues, cron, or custom process supervision.

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
npm run build
```

The build must create `.next/standalone/server.js`.

## Standalone Artifact Copy

If Plesk expects `server.js` at the application root, copy the standalone output into a deployment folder:

```bash
rm -rf deploy/plesk
mkdir -p deploy/plesk/.next
cp -R .next/standalone/* deploy/plesk/
cp -R .next/static deploy/plesk/.next/static
cp -R public deploy/plesk/public
```

On Windows, do the equivalent copy through File Manager, SFTP, or a deployment script. Upload the contents of `deploy/plesk` to the Plesk application root. Keep `.next/static` and `public` beside the standalone server.

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

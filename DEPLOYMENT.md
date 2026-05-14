# Deployment Runbook

Clinical Ethereality deploys as a single Next.js application on Vercel with Prisma and MySQL. Keep preview, staging, and production environments separate because consultations, prescriptions, payments, orders, notifications, and community moderation records are sensitive.

## Vercel Project

- Framework preset: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `.next`
- Preferred region: Singapore (`sin1`) for lower latency from Thailand
- Health check path: `/api/health`

`vercel.json` pins the shared deployment commands and disables the local dev auth bypass by default. Do not override `ENABLE_DEV_AUTH_BYPASS` to `true` in any hosted Vercel environment.

## Preview Deployments

Use Vercel preview deployments for pull requests and non-production branches.

Required preview settings:

- Use a non-production MySQL database.
- Use non-production LINE LIFF/channel credentials.
- Use non-production PromptPay/slip-verification credentials, or leave payment provider credentials blank.
- Use non-production Zoom credentials, or leave Zoom credentials blank until the Zoom SDK workflow is implemented.
- Keep `ENABLE_DEV_AUTH_BYPASS=false`.
- Set `NEXT_PUBLIC_APP_URL` to the Vercel preview URL when testing callbacks.
- Set `LINE_LOGIN_CALLBACK_URL` to `${NEXT_PUBLIC_APP_URL}/api/auth/line/callback`.

Preview validation checklist:

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npx prisma validate`
- `npm run build`
- Visit `/api/health` and confirm it returns `{"status":"ok","service":"clinical-ethereality"}`.
- Visit `/auth/line` and confirm the hosted auth entry loads.

## Staging Environment

Use staging as the production-like environment for operational acceptance before launch.

Staging must have:

- A dedicated managed MySQL database, not preview or production.
- Dedicated LINE LIFF/channel credentials.
- Dedicated storage bucket or Cloudinary account/folder.
- Dedicated payment provider credentials with test mode or limited operational access.
- Dedicated Zoom app credentials.
- Error monitoring configured before staff testing.
- A backup plan tested before patient-like records are entered.

Use `.env.staging.example` as the staging variable checklist and `STAGING.md` as the staging setup runbook.

Staging validation must pass the same local quality gates used for preview plus hosted checks against `/api/health`, `/auth/line`, and role-protected routes.

Backups and restore drills are documented in `BACKUPS.md`; staging restore drills must use synthetic data only.

Run Prisma migrations through a controlled workflow once migrations are finalized. Until production deployment is approved, do not point staging at production data.

## Production Environment

Production launch is blocked until the client supplies compliance and operational inputs listed in `CLIENT_INTAKE.md`.

Before production:

- Confirm Thai PDPA, Terms of Service, consent wording, pharmacy SOPs, payment ownership details, and support contact.
- Confirm HIPAA or other health-data compliance posture if protected health information will be stored.
- Use vendors that can support the required compliance posture and agreements.
- Enable backups and restore testing for the production database.
- Enable error monitoring.
- Disable all test credentials and local bypasses.
- Review audit retention and sensitive-record access rules.

Use `.env.production.example` as the production variable checklist and `PRODUCTION.md` as the production launch runbook.

Production deployment must not be promoted from staging until backup, monitoring, compliance, rollback, and vendor credential checks are complete.

Production backups must follow `BACKUPS.md` and remain enabled before patient-like records are entered.

## Environment Variables

Use `.env.example` as the source list for required keys. Store actual values in Vercel environment settings, not in git.

Minimum deployment keys:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ISSUER`
- `JWT_ACCESS_TOKEN_TTL`
- `JWT_REFRESH_TOKEN_TTL`
- `ENABLE_DEV_AUTH_BYPASS`
- `NEXT_PUBLIC_LINE_LIFF_ID`
- `LINE_CHANNEL_ID`
- `LINE_CHANNEL_SECRET`
- `LINE_LOGIN_CALLBACK_URL`

Integration keys become required only when the related workflow is enabled:

- Payments: `THAI_QR_PROMPTPAY_ID`, `SLIP_VERIFICATION_PROVIDER`, `SLIP_VERIFICATION_API_KEY`, provider-specific values, and `PAYMENT_WEBHOOK_SECRET`
- Video: Zoom SDK and webhook keys
- Storage: Cloudinary or S3-compatible object storage keys
- Monitoring: `SENTRY_DSN`

# Staging Environment

Staging is the production-like validation environment for Clinical Ethereality. It should behave like production while using isolated credentials, isolated storage, and an isolated database.

## Purpose

Use staging to validate:

- LINE LIFF login and callback configuration
- Role boundaries for customer, doctor, pharmacist, and admin workflows
- Prisma schema compatibility with the managed MySQL provider
- Thai QR and slip verification behavior with test or limited credentials
- Zoom integration behavior once the SDK workflow is implemented
- Storage integration for files and attachments once selected
- Error monitoring and operational health checks

Do not use staging for live patient, prescription, payment, or pharmacy fulfillment records.

## Required Services

- Vercel project environment: `staging`
- Managed MySQL database: dedicated staging instance
- LINE LIFF/channel: dedicated staging channel
- Storage: dedicated staging Cloudinary folder/account or S3 bucket
- Payments: provider test credentials or disabled credentials
- Zoom: dedicated staging/test app credentials or disabled credentials
- Monitoring: staging Sentry project or staging environment tag

## Environment Rules

- `ENABLE_DEV_AUTH_BYPASS=false`
- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_URL` must be the staging URL.
- `LINE_LOGIN_CALLBACK_URL` must be `${NEXT_PUBLIC_APP_URL}/api/auth/line/callback`.
- `DATABASE_URL` must point to staging only.
- Payment, Zoom, and storage credentials must not be shared with production.
- Secrets must be stored in Vercel environment settings, not committed to git.

Use `.env.staging.example` as the staging variable checklist.

## Database Workflow

Until production deployment is approved, staging can use the current Prisma schema push workflow for validation. Once migrations become the release source of truth, staging should use controlled migration deployment.

Recommended staging database steps:

1. Create a dedicated managed MySQL database.
2. Set `DATABASE_URL` in the Vercel staging environment.
3. Run `npx prisma validate` before deployment.
4. Apply schema changes through the approved deployment workflow.
5. Seed only synthetic staging data.
6. Confirm `/api/health` after deployment.

Staging must never connect to production data.

## Release Checklist

Before accepting a staging deployment:

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npx prisma validate`
- `npm run build`
- `/api/health` returns `{"status":"ok","service":"clinical-ethereality"}`
- `/auth/line` loads with the staging LIFF configuration
- Customer routes redirect unauthenticated users to `/auth/line`
- Admin, doctor, and pharmacist routes enforce role boundaries
- Audit-sensitive actions remain behind authenticated routes

## Production Gate

Do not promote staging to production until:

- Client intake requirements in `CLIENT_INTAKE.md` are supplied.
- Compliance posture is reviewed for health-adjacent records.
- Backup and restore workflow is documented and tested.
- Error monitoring is enabled.
- Production vendor credentials and access controls are approved.

Backup and restore drill details live in `BACKUPS.md`.

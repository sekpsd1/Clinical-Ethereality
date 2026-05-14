# Production Environment

Production is the live environment for customers, doctors, pharmacists, and admins. It must not be enabled for patient-like records until compliance, backup, monitoring, and vendor decisions are complete.

## Launch Gate

Production launch is blocked until:

- Thai PDPA Privacy Policy is received and approved.
- Thai Terms of Service are received and approved.
- Health-data, teleconsultation, prescription, and pharmacy consent wording is received and approved.
- Company, billing, sender, and support contact details are confirmed.
- Doctor and pharmacist license data is confirmed.
- Product catalog, FDA numbers, pricing, inventory, and prescription flags are confirmed.
- Prescription verification, medicine preparation, shipment, payment review, and moderation SOPs are confirmed.
- PromptPay ownership and slip verification provider credentials are confirmed securely.
- Storage provider and compliance posture are approved.
- Backup and restore workflow is documented and tested.
- Error monitoring is enabled.

## Required Services

- Vercel production deployment
- Managed MySQL production database
- Production LINE LIFF/channel
- Production Cloudinary account/folder or S3-compatible bucket
- Production payment provider credentials
- Production Zoom app credentials once video consultation is enabled
- Production error monitoring
- Database backup and restore workflow

## Environment Rules

- `NODE_ENV=production`
- `ENABLE_DEV_AUTH_BYPASS=false`
- `NEXT_PUBLIC_APP_URL` must be the canonical production URL.
- `LINE_LOGIN_CALLBACK_URL` must be `${NEXT_PUBLIC_APP_URL}/api/auth/line/callback`.
- `DATABASE_URL` must point only to the approved production database.
- `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` must point only to the approved production Sentry project.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` should be set when production source-map uploads are approved.
- Preview or staging credentials must never be reused in production.
- Secrets must be stored in Vercel production environment settings, not committed to git.
- Feature flags for payments, prescriptions, community, video, and patient portal should stay disabled until their compliance and vendor gates are approved.

Use `.env.production.example` as the production variable checklist.

## Deployment Checklist

Before each production deploy:

- Confirm staging is green and uses the same commit intended for production.
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npx prisma validate`
- `npm run build`
- Confirm backup status before schema changes.
- Confirm the latest backup or snapshot is available before risky changes.
- Confirm rollback plan for the deploy.
- Confirm `/api/health` after deploy.
- Confirm `/auth/line` loads with production LIFF configuration.
- Confirm role-protected routes still enforce access boundaries.
- Confirm production error monitoring receives a non-sensitive test event.

## Data Protection Rules

- Treat consultations, prescriptions, payment records, order records, reward adjustments, community moderation records, images, and attachments as sensitive.
- Store file metadata in MySQL and file bytes only in the approved object storage provider.
- Keep audit logs enabled for sensitive state transitions.
- Prefer non-destructive updates for prescriptions, payment review, fulfillment, shipment, and reward records.
- Do not seed synthetic records into production.

## Production Rollback

For a failed production deploy:

1. Stop rollout and keep the current production URL on the last known good deployment.
2. Check Vercel deployment logs and monitoring alerts.
3. Confirm whether database schema changes were applied.
4. If database changes were applied, follow the documented restore or forward-fix plan.
5. Record the incident and follow-up tasks in `PROJECT_STATE.md`.

## Post-Launch Checks

After launch:

- Verify `/api/health`.
- Verify LINE LIFF login.
- Verify customer, doctor, pharmacist, and admin route boundaries.
- Verify payment provider configuration without exposing real credentials.
- Verify monitoring receives production errors.
- Verify backup schedule and restore documentation.

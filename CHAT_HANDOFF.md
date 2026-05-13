# Clinical Ethereality Handoff

Use this file when starting a new chat so the next agent can continue with low context usage.

## Latest State

- Repository: `C:\Projects\clinical-ethereality`
- Branch: `main`
- Latest pushed commit: `466e4e0 Add auth foundation and admin approval shell`
- Stack: Next.js 15, React 19, TypeScript, Tailwind CSS, Prisma, MySQL target
- Local dev URL: `http://localhost:3001`
- Customer MVP auth direction: LINE Mini App / LINE LIFF only
- Email login: deferred until after the LINE Mini App MVP is complete
- Local preview: `.env.local` enables `ENABLE_DEV_AUTH_BYPASS=true` and is gitignored

## Completed Work

### Frontend Static Stitch Screens

Customer screens are implemented as static Stitch-inspired UI and should not be redesigned.

Consult:

- `/consult`
- `/consult/booking/somchai`
- `/consult/payment`
- `/consult/waiting-room`
- `/consult/live`
- `/consult/advice-log`

Store:

- `/store`
- `/store/paracetamol-500mg`
- `/store/checkout`
- `/store/payment-success`

Community/Profile:

- `/profile`
- `/community`
- `/community/search`
- `/community/create`
- `/community/vitamin-c-tips`
- `/notifications`

Shared customer navigation:

- `Consult | Store | Community | Profile`
- Implemented through `components/navigation/FooterNav.tsx`
- Payment and checkout screens keep the active tab of their parent flow.
- Live consultation hides footer navigation.
- Notification Center is a sub-screen, not a root footer tab.

Recent UI fix:

- `features/consultations/ConsultDoctorList.tsx` booking CTA text is centered with flex alignment.

### Auth And Session Foundation

Implemented:

- `/auth/line` LINE LIFF auth entry screen
- `/api/auth/line/session` verifies LINE ID token and creates app session
- `/api/auth/session` current session
- `/api/auth/refresh` refresh session
- `/api/auth/logout` logout/revoke
- `/api/auth/dev-session` local-only dev bypass when enabled
- JWT access/refresh cookies
- Refresh token hashes persisted on auth sessions
- Middleware protects customer routes and role route prefixes
- Local dev bypass buttons on `/auth/line`:
  - `Enter as customer`
  - `Enter as admin`

Important auth files:

- `features/auth/LineLiffLogin.tsx`
- `lib/auth/jwt.ts`
- `lib/auth/edge-jwt.ts`
- `lib/auth/session.ts`
- `lib/auth/users.ts`
- `lib/auth/guards.ts`
- `middleware.ts`

### Prisma Foundation

Current Prisma models:

- `User`
- `AuthSession`
- `Doctor`
- `Pharmacist`

Current Prisma enums:

- `UserRole`
- `AccountStatus`
- `AuthSessionStatus`
- `StaffProfileStatus`

Notes:

- `User.lineUserId` is unique and is the primary customer identity source.
- JWT `sub` uses `User.id`.
- `Doctor` and `Pharmacist` are one-to-one staff profiles linked to `User`.
- No full business-domain models yet for consultations, products, inventory, orders, payments, prescriptions, community, notifications, or rewards.

### Permissions

Implemented:

- `lib/permissions/roles.ts`
- `lib/permissions/permissions.ts`
- `lib/permissions/index.ts`

Prepared route boundaries:

- `/admin/*` requires admin
- `/doctor/*` requires doctor or admin
- `/pharmacist/*` requires pharmacist or admin

### Admin Foundation

Implemented:

- `/admin` dashboard shell and static operational overview
- `/admin/users` user and role approval screen
- Dedicated admin shell/navigation in `components/layout/AdminShell.tsx`
- Admin guard in `app/admin/layout.tsx`
- Admin users backend structure:
  - `features/admin/users/queries.ts`
  - `features/admin/users/actions.ts`
  - `features/admin/users/schema.ts`
  - `features/admin/users/types.ts`

Admin user approvals:

- Reads Prisma users with doctor/pharmacist profiles when DB is available.
- Shows a DB-offline empty state when DB is unavailable.
- Server Action boundaries exist for approving staff roles and suspending users.
- Inline success/error UX is not done yet.

## Still Not Done

Database and seed:

- Real `DATABASE_URL` has not been configured in the repo.
- No migration or `prisma db push` has been run against a real database.
- No seed data yet.
- Next recommended work is local DB setup plus seed data for admin/customer/doctor/pharmacist.

Auth:

- LINE Developers/LIFF real credentials are not configured.
- Real LINE Mini App flow has not been tested.
- Local dev bypass is only for preview and must stay disabled in production.

Admin:

- `/admin/users` has query/action boundaries, but no inline action feedback.
- No full admin management screens yet for payments, orders, prescriptions, inventory, products, content moderation, or reports.

Consult backend:

- No doctor availability model yet.
- No admin schedule editor.
- No slot locking.
- No real booking Server Actions.
- No Zoom SDK integration.

Commerce backend:

- No product/catalog/inventory/order/payment models yet.
- No Thai QR generation.
- No slip upload or Slip Verification API.
- No shipment tracking persistence.

Community backend:

- No article/post/comment/like/report/notification/reward persistence yet.

Quality/deployment:

- No unit/component/Playwright tests yet.
- No CI/staging/production setup.
- Compliance/vendor decisions still pending.

## Important Constraints

- Follow `AGENTS.md`.
- Do not redesign finalized Stitch screens.
- Keep customer routes and UI mobile-first for LINE LIFF.
- Keep routes thin and put domain logic in `features/*`.
- Put cross-cutting services in `lib/*`.
- Treat patient data, prescriptions, payment records, order records, images, and attachments as sensitive.
- Enforce permissions on the server, not only the UI.
- Ask before architecture changes.
- Update `PROJECT_STATE.md` and `TASKS.md` after meaningful backend decisions.

## Known Caveats

- Some older Thai strings in generated source files may show mojibake from earlier Stitch exports.
- Many customer screens still use static mock data.
- Running `next build` while `next dev` is active can corrupt `.next` chunks on this Windows setup.
- If a dev page shows `Cannot find module './331.js'`, stop the dev server, delete `.next`, and restart.
- Prisma generate can hit Windows file locks if the dev server is running. Stop dev server before regenerating Prisma Client.
- `.env.local` exists locally for dev bypass and is intentionally gitignored.

## Verification Commands

Run before completion:

```powershell
npm run lint
npm run typecheck
$env:DATABASE_URL='mysql://user:password@localhost:3306/clinical_ethereality'; npx prisma validate
npm run build
```

Latest known verification:

- `npm run lint` passed
- `npm run typecheck` passed
- `npx prisma validate` passed with a temporary MySQL URL
- `npm run build` passed

## Recommended Next Step

Recommended next work:

1. Set up database-backed local development.
2. Decide local DB strategy and real `DATABASE_URL`.
3. Run Prisma schema against DB with `prisma db push` or migration path.
4. Add seed data for:
   - admin
   - customer
   - doctor
   - pharmacist
5. Make `/admin/users` show seeded users and test approve/suspend actions.
6. Then continue to doctor availability/admin scheduling.

## Prompt For New Chat

Short prompt:

```txt
Project: C:\Projects\clinical-ethereality

Read CHAT_HANDOFF.md first, then AGENTS.md only for repo rules. Continue from latest main commit 466e4e0.

Current state: customer Stitch screens done; LINE-only MVP auth foundation done; Prisma User/AuthSession/Doctor/Pharmacist done; /admin and /admin/users foundation done; local dev auth bypass exists.

Next: set up DB-backed local development, Prisma db push/migration plan, seed admin/customer/doctor/pharmacist data, and make /admin/users show seeded users. Keep Stitch frontend unchanged. Update PROJECT_STATE.md/TASKS.md. Run lint, typecheck, prisma validate, build.
```

Full prompt:

```txt
Project: C:\Projects\clinical-ethereality

Read only these first:
1. CHAT_HANDOFF.md
2. AGENTS.md for repo rules only
3. PROJECT_STATE.md latest status
4. TASKS.md latest checklist

Continue from latest main commit. Do not re-read all source files unless needed.

Current status summary:
- Customer Stitch static screens are built: Consult, Store, Community, Profile.
- LINE Mini App/LIFF is the only MVP login path. Email login is post-MVP only.
- Auth foundation is implemented: LINE session route, JWT cookies, refresh/logout/session routes, middleware protection, local dev auth bypass.
- Prisma foundation exists for User, AuthSession, Doctor, Pharmacist.
- Admin foundation exists: /admin dashboard and /admin/users role approval screen with Prisma query/action boundaries.
- Latest commit pushed: 466e4e0 Add auth foundation and admin approval shell.

Next task:
Set up database-backed local development next:
1. Add/confirm DATABASE_URL strategy.
2. Prepare Prisma db push/migration path.
3. Add seed data for local admin, customer, doctor, pharmacist.
4. Make /admin/users show seeded users and let dev admin approve/suspend.
5. Keep existing Stitch frontend unchanged.

Before editing:
- Inspect current repo structure only as needed.
- Preserve user edits.
- Update PROJECT_STATE.md and TASKS.md after meaningful backend decisions.
- Run lint, typecheck, prisma validate, and build before final.
```

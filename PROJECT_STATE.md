# Project State

## Project

Clinical Ethereality

## Phase

Backend authentication and user persistence foundation.

The project now contains a Next.js 15, React 19, TypeScript, and Tailwind CSS scaffold, the reviewed static customer Stitch screens, the first backend foundation for LINE LIFF authentication, Prisma-backed users/auth sessions, doctor/pharmacist profile models, JWT sessions, role/permission helpers, protected customer routes, and an initial role-protected admin dashboard shell. The customer UI remains static and unchanged; the backend foundation does not yet include payment verification, Zoom SDK, or admin scheduling.

## Current Decisions

- Product category: clinical aesthetics commerce, consultation, pharmacy, and community web app
- Primary experience: authenticated platform for customers/patients, doctors, pharmacists, and admins
- Architecture pattern: modular monolith inside a single Next.js app
- Primary mutation pattern: Next.js Server Actions
- Route handlers reserved for LINE callback, webhooks, health checks, and integration endpoints
- Recommended frontend framework: Next.js 15 with App Router and React 19
- Recommended language: TypeScript
- Recommended database: MySQL
- Recommended ORM: Prisma
- Recommended styling: Tailwind CSS implementing the finalized Stitch design system
- Recommended backend approach: Next.js Server Actions
- Recommended authentication: LINE LIFF plus JWT
- User entry requirement: customers/patients must enter through the LINE Mini App/LINE LIFF experience; users without LINE must create or use a LINE account before accessing the app
- Primary account identity: LINE user identity is the required customer identity source; no standalone email/password or guest customer account path is planned for MVP, and email login is deferred until after the LINE Mini App MVP is complete
- Initial auth implementation: LINE LIFF ID token verification upserts a Prisma `User`, creates a Prisma `AuthSession`, and issues httpOnly JWT access and refresh cookies
- Session subject: JWT `sub` now uses the Prisma `User.id`; LINE identity remains stored on `User.lineUserId`
- Refresh session storage: refresh tokens are stored only as SHA-256 hashes on `AuthSession` records and are rotated on refresh
- Route protection: customer app routes redirect unauthenticated users to `/auth/line`; future `/admin`, `/doctor`, and `/pharmacist` routes have role boundaries in middleware
- Local development access: `ENABLE_DEV_AUTH_BYPASS=true` enables `/api/auth/dev-session` and local customer/admin buttons on `/auth/line`; this is disabled in production and does not replace LINE LIFF for MVP
- Admin foundation: `/admin` now has an admin-only shell and operational overview backed by Prisma counts for user approvals, consultations, payments, prescriptions, orders, inventory, and hidden community content when the database is available
- Admin user approvals: `/admin/users` now reads Prisma users with doctor/pharmacist profiles when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions with inline success/error feedback for approving staff roles and suspending users
- Admin payment review foundation: `/admin/payments` now reads Prisma payment, order, customer, and item records when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions for manual PromptPay slip verification or rejection
- Admin order management foundation: `/admin/orders` now reads Prisma order, customer, item, payment, and shipment records when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions for moving orders through preparation, shipped, and delivered states
- Admin inventory management foundation: `/admin/inventory` now reads Prisma product and inventory records when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions for updating stock quantity and low-stock thresholds
- Doctor consultation, patient log, and prescription writing foundation: `/doctor/consultations` and `/doctor/patients` now read Prisma consultation, patient, and prescription records scoped to the signed-in doctor profile when a database is available, fall back to DB-offline/profile-missing empty states, allow admins to view all doctor queues for operations support, and include a doctor/admin Server Action for submitting prescription notes to pharmacist verification
- Pharmacist prescription queue foundation: `/pharmacist/prescriptions` now reads Prisma prescription, patient, doctor, consultation, and linked order-item records when a database is available, falls back to a DB-offline empty state, and includes pharmacist/admin Server Actions for manual prescription verification or rejection
- Pharmacist medicine preparation foundation: `/pharmacist/orders` now reads paid, preparing, and shipped order queues with customer, payment, shipment, and item context when a database is available, falls back to a DB-offline empty state, and includes pharmacist/admin Server Actions for moving orders through preparation, shipped, and delivered states
- Local seed data: `prisma/seed.mjs` creates development admin, customer, pending/approved doctor and pharmacist, suspended customer, products, inventory, consultation, prescription, order, payment, shipment, moderation, notification, and reward records for testing admin queues
- Staff profile persistence: Prisma includes `Doctor` and `Pharmacist` profile models linked one-to-one with `User`, with license, status, approval, and basic workflow metadata
- Domain schema foundation: Prisma now includes consultation, prescription, product, inventory, order, order item, payment, shipment tracking, article, comment, like, notification, and reward point models with core status enums, ownership relations, and indexes
- Database migration foundation: Prisma initial migration `20260513120000_init` now captures the current MySQL schema for auth, staff profiles, consultations, prescriptions, commerce, inventory, payments, shipments, community, notifications, and reward records
- Initial role assignment: LINE LIFF sessions default to `customer`; doctor, pharmacist, and admin roles remain reserved for the future invitation/approval flow
- Permission enforcement direction: reusable server helpers in `lib/permissions/*` should be called from Server Actions and route handlers before sensitive reads or writes
- Integration route placeholders: `/api/auth/line/callback`, `/api/webhooks/payments`, and `/api/webhooks/zoom` now exist as guarded placeholders; payment and Zoom persistence remain intentionally unimplemented until providers are selected
- Recommended video call integration: Zoom SDK
- Recommended payment approach: Thai QR plus Slip Verification API
- Recommended deployment: Vercel app with managed MySQL
- Recommended storage: Cloudinary or S3-compatible object storage for attachments and images
- Recommended validation: Zod
- Recommended testing: Vitest and Playwright
- UI/UX source of truth: finalized Stitch design specification
- Frontend architecture priority: reusable mobile-first components for LINE LIFF
- State management direction: server-first with Server Components, Server Actions, React Hook Form for complex forms, URL state for filters, and minimal client context
- Final customer footer navigation: `Consult | Store | Community | Profile`
- Implementation priority: build the 16 reviewed Stitch screens first, then add only supporting connector screens needed to complete the MVP flow

## Architecture Summary

The app should be organized around domain modules rather than technical silos. Routes should stay thin, reusable UI should live in `components/*`, business logic should live in `features/*`, and cross-cutting services should live in `lib/*`.

Core layers:

- Presentation: mobile-first React routes and components
- Server actions: validated mutations and permission enforcement
- Domain services: role-aware business logic
- Data access: Prisma over MySQL
- Integrations: LINE LIFF, JWT, Zoom SDK, Thai QR, Slip Verification API, Cloudinary or S3, email, SMS, monitoring

Core route areas:

- Public products and articles
- Auth and LINE callback
- Authenticated customer app
- Doctor consultation workflow
- Pharmacist prescription and fulfillment workflow
- Admin operations
- Webhooks for payment and Zoom events

## Stitch Screen Inventory

Consult:

- Doctor list: implemented at `/consult`
- Doctor profile and booking: implemented at `/consult/booking/somchai`
- Consultation PromptPay checkout: implemented at `/consult/payment`
- Waiting room: implemented at `/consult/waiting-room`
- Live consultation: implemented at `/consult/live`
- Advice log: implemented at `/consult/advice-log`

Store:

- Health marketplace: implemented at `/store`
- Product detail: implemented at `/store/paracetamol-500mg`
- Store checkout: implemented at `/store/checkout`
- Payment success and tracking: implemented at `/store/payment-success`

Community and Profile:

- User profile: implemented at `/profile`
- Community hub: implemented at `/community`
- Create new post: implemented at `/community/create`
- Article/post detail and comments: implemented at `/community/vitamin-c-tips`
- Notification center: implemented at `/notifications`
- Community search results: implemented at `/community/search`

Admin:

- Admin dashboard shell: implemented at `/admin` as a role-protected static operational overview
- Admin user and role approvals: implemented at `/admin/users` as a role-protected Prisma-backed approval queue with DB-offline fallback
- Admin payment review: implemented at `/admin/payments` as a role-protected Prisma-backed PromptPay review queue with manual verify/reject actions
- Admin order management: implemented at `/admin/orders` as a role-protected Prisma-backed fulfillment queue with manual preparation/shipped/delivered actions
- Admin inventory management: implemented at `/admin/inventory` as a role-protected Prisma-backed stock queue with manual quantity and threshold updates
- Doctor consultation queue and prescription writing: implemented at `/doctor/consultations` as a role-protected Prisma-backed consultation queue scoped to the signed-in doctor profile, with guarded prescription note submission to pharmacist verification
- Doctor patient logs: implemented at `/doctor/patients` as a role-protected Prisma-backed patient history view scoped to assigned consultations
- Pharmacist prescription queue: implemented at `/pharmacist/prescriptions` as a role-protected Prisma-backed verification queue with manual verify/reject actions
- Pharmacist medicine preparation: implemented at `/pharmacist/orders` as a role-protected Prisma-backed fulfillment queue with manual preparation/shipped/delivered actions

## Decisions Still Needed

- Confirm exact MVP scope
- Choose managed MySQL host
- Choose Cloudinary or S3-compatible storage
- Confirm LINE LIFF channel setup
- Confirm JWT issuing, expiry, refresh, and revocation strategy
- Decide whether production will store protected health information
- Decide whether HIPAA-eligible vendors and BAAs are required from day one
- Decide whether customer product browsing and order tracking are public, authenticated, or hybrid
- Confirm Zoom SDK implementation approach
- Choose Slip Verification API provider
- Decide whether Thai QR payments are manual-review MVP or fully automated after slip verification
- Community is included in MVP using the reviewed Stitch screens
- Decide whether delivery tracking is internal status only or carrier-integrated
- Define brand direction and visual identity
- Obtain or reference the finalized Stitch token/specification export before implementation
- Map Stitch colors, typography, spacing, radius, glass surfaces, shadows, and footer navigation into Tailwind
- Confirm whether any Stitch source files can be exported for exact tokens, images, and spacing values
- Collect client intake materials listed in `CLIENT_INTAKE.md`
- Confirm PDPA Privacy Policy, Terms of Service, health-data consent, teleconsultation consent, refund/cancellation policy, and community guidelines
- Confirm company legal name, tax ID, billing address, parcel sender address, and support contact
- Confirm doctor onboarding data, medical license, consultation fee, schedule, and official profile photo
- Confirm product catalog, FDA numbers, medical-standard product images, prices, stock, and prescription requirements
- Confirm pharmacy license data, pharmacist license data, and prescription verification SOP
- Confirm PromptPay account, bank account details, and SlipOK/EasySlip provider/API details

## Proposed MVP

The first build should likely include:

- LINE LIFF login with JWT session handling
- Mobile-first authenticated app shell with persistent bottom navigation
- Stitch-based design system implementation
- Tailwind theme mapped from Stitch tokens
- Reusable UI primitives and domain components
- Final customer footer navigation: `Consult | Store | Community | Profile`
- Consult flow from doctor list through advice log
- Store flow from marketplace through payment success and tracking
- Community flow from hub through post creation, detail/comments, notifications, and search
- Profile hub with settings links
- Role-based access control and permission helpers
- Admin dashboard
- Customer/patient profiles
- Doctor users and profiles
- Pharmacist users and profiles
- Product catalog
- Inventory foundation
- Orders, order items, and order status tracking
- Thai QR payment instructions, slip upload, and payment review workflow
- Slip Verification API integration boundary
- Zoom consultation metadata and launch path
- Patient history captured through users and consultations
- Prescription creation
- Prescription verification
- Shipment tracking status updates
- Articles, comments, likes, reporting, and moderation foundation
- Notifications foundation
- Reward points foundation
- Audit metadata on sensitive entities

## Supporting Screens To Add Only As Needed

- Booking confirmation
- Payment pending
- Payment rejected
- Appointment detail
- Prescription verification status
- Order from prescription
- Order detail
- Saved articles
- Shipping addresses
- Settings

These screens should reuse Stitch-derived components and visual patterns from the 16 reviewed screens. Do not create unrelated new UI patterns.

## App Folder Structure

Use this structure when implementation starts:

- `app/`: route groups, layouts, pages, route handlers, and webhooks
- `components/`: reusable UI, layout, navigation, and domain presentation components
- `features/`: domain actions, queries, services, schemas, and feature-specific components
- `lib/`: auth, database, environment, permissions, validation helpers, design-system tokens, and integration clients
- `prisma/`: schema, migrations, and seed data
- `public/`: static assets and photography placeholders
- `tests/`: unit, integration, and Playwright tests

## API Plan

- Use Server Actions for first-party mutations.
- Use route handlers only for external callbacks and webhooks.
- Validate inputs with Zod at the server boundary.
- Enforce permissions in server code, not only in UI.
- Keep all sensitive prescription, payment, consultation, and order data behind authenticated routes.

## Frontend Architecture Decisions

- Follow the Stitch design system strictly.
- Do not redesign finalized UI.
- Use Stitch as the source of truth for Tailwind tokens and reusable components.
- Maintain one shared footer navigation implementation with `Consult | Store | Community | Profile`.
- Keep layouts mobile-first for LINE LIFF.
- Prefer server-first state management and avoid global client state unless justified.

## Current Implementation Handoff

Completed in the current frontend pass:

- Project scaffold: Next.js 15.5, React 19, TypeScript strict mode, Tailwind CSS, ESLint, Prisma placeholder schema, and `package-lock.json`.
- App shell: shared customer `AppShell`, global `TopAppBar`, and shared `FooterNav` for root customer areas.
- Design system foundation: Stitch-inspired tokens in `lib/design-system/tokens.ts`, variants helper, component contracts, and added shadows/backgrounds needed by the Consult screens.
- Consult doctor list: `/consult`, implemented from Figma with doctor cards, search bar, filter chips, local doctor images, and booking CTA.
- Doctor booking: `/consult/booking/somchai`, implemented from Figma with doctor bio card, calendar mock, time slots, and booking CTA.
- Consult payment checkout: `/consult/payment`, implemented from Figma with booking summary, PromptPay QR, slip upload mock, and payment submit CTA.
- Waiting room: `/consult/waiting-room`, implemented from Figma with payment-confirmed status, countdown, doctor brief, preparation checklist, camera/mic test CTA, and join consultation CTA.
- Live consultation: `/consult/live`, implemented from Stitch zip reference with compact video shell, chat transcript, prescription attachment, composer, and end-call CTA.
- Advice log: `/consult/advice-log`, implemented from Stitch zip reference with doctor summary, medical note, prescription list, attachment, order medicine CTA, and PDF download CTA.
- Store health marketplace: `/store`, implemented from Stitch zip reference with custom marketplace header, search field, cart indicator, category cards, recommended product cards, and local product imagery.
- Store product detail: `/store/paracetamol-500mg`, implemented from Stitch zip reference with custom detail header, product hero, prescription-required warning, advice log selector, description card, and sticky buy CTA.
- Store checkout: `/store/checkout`, implemented from Stitch zip reference with order item cards, PromptPay QR payment summary, slip upload area, delivery address, and payment confirmation CTA.
- Store payment success and tracking: `/store/payment-success`, implemented from Stitch zip reference with slip verification result, pharmacy preparation timeline, main-store return action, and pharmacy sync badge.
- User profile: `/profile`, implemented from Stitch zip reference with custom profile header, teal verified member hero, advice/posts stats, settings menu rows, logout action, and app version note.
- Community hub: `/community`, implemented from Stitch zip reference with custom community header, search field, verified featured content card, category chips, and community feed cards.
- Create new post: `/community/create`, implemented from Stitch zip reference with custom compose header, topic/content inputs, image upload area, category selector chips, post CTA, and terms note.
- Article detail and comments: `/community/vitamin-c-tips`, implemented from Stitch zip reference with fixed detail header, hero article image, glass content card, interaction bar, comment list, and sticky comment composer.
- Notification center: `/notifications`, implemented from Stitch zip reference with custom notification header, mark-read action, latest updates heading, unread notification glow, read cards, system update, and promotion card.
- Community search results: `/community/search`, implemented from Stitch zip reference with search keyword, filter chips, result cards, author meta, likes, comments, and community footer context.
- Prisma auth models: `User` and `AuthSession` have been added with role/status enums, `lineUserId` uniqueness, session status, refresh token hash storage, and expiry indexes.
- Auth/session foundation: `/api/auth/line/session` verifies a LINE LIFF ID token through LINE, upserts the customer `User`, creates an `AuthSession`, and issues httpOnly JWT access/refresh cookies using the Prisma user ID.
- Session route handlers: `/api/auth/session`, `/api/auth/refresh`, and `/api/auth/logout` expose current-session, refresh, and logout boundaries without changing the existing Stitch frontend.
- LINE auth entry: `/auth/line` loads the LINE LIFF SDK, exchanges the ID token for an app session, attempts refresh first when possible, and redirects users back to their requested path.
- Local dev bypass: `/api/auth/dev-session` can issue local-only customer/admin JWT cookies when `ENABLE_DEV_AUTH_BYPASS=true` and `NODE_ENV` is not production.
- Route protection: middleware protects `/consult`, `/store`, `/community`, `/notifications`, and `/profile`, with role boundaries prepared for future `/admin`, `/doctor`, and `/pharmacist` routes.
- Admin shell: `/admin` uses a dedicated operational layout with admin navigation and static queue modules for role approvals, consultations, payments, prescriptions, orders, stock, moderation, and audit activity.
- Admin user approvals: `/admin/users` establishes the UI for role requests, current/requested role review, approve/suspend controls, approval safeguards, Prisma query structure, and Server Action boundaries.
- Admin payment review: `/admin/payments` establishes the first data-backed payment queue with order/customer context and manual verify/reject Server Actions.
- Admin order management: `/admin/orders` establishes the first data-backed fulfillment queue with order/customer/item/payment/shipment context and guarded status update Server Actions.
- Admin inventory management: `/admin/inventory` establishes the first data-backed stock queue with product/inventory context and guarded stock update Server Actions.
- Doctor consultations: `/doctor/consultations` establishes the first doctor back-office queue with doctor-scoped consultation/patient/prescription context, DB-offline/profile-missing fallbacks, and guarded prescription note submission to pharmacist verification.
- Doctor patient logs: `/doctor/patients` establishes doctor-scoped patient history summaries from assigned consultations and prescriptions.
- Pharmacist prescriptions: `/pharmacist/prescriptions` establishes the first pharmacist back-office queue with prescription/patient/doctor/consultation context and guarded verify/reject Server Actions.
- Pharmacist medicine preparation: `/pharmacist/orders` establishes the first pharmacist fulfillment queue with paid/preparing/shipped orders and guarded preparation, shipment, and delivery status update Server Actions.
- Permission foundation: reusable role and permission helpers live in `lib/permissions/*` for future Server Actions, route handlers, and domain services.
- Static assets copied into `public/images/doctors`, `public/images/profiles`, and `public/images/payments`.
- Local database verification: local MySQL schema `clinical_ethereality` was pushed and seeded with `npm run db:push` and `npm run db:seed` using the project-owned Docker MySQL container `clinical-ethereality-db` on `127.0.0.1:3307`.
- Verification passed after the latest changes: `npm run lint`, `npm run build`, and `npx tsc --noEmit`.
- Local dev server was restarted cleanly at `http://localhost:3001`.

Known frontend caveats:

- Consult screens use static mock data only.
- Store marketplace uses static mock data only.
- Some deep-flow screens intentionally use custom headers/footers based on Stitch references instead of the root `FooterNav`.
- `LiveConsultation` and `AdviceLog` were refined from Stitch `.zip` exports, not live Figma MCP, because the Starter plan MCP read quota was exhausted.
- Running `next build` while `next dev` is active can corrupt `.next` dev chunks on this Windows setup. After builds, stop dev server, clear `.next`, and restart `npm run dev -- -p 3001`.

Not implemented yet:

- Business-domain queries beyond the current admin, doctor, and pharmacist back-office foundations.
- Broader data-backed management screens, doctor screens, and pharmacist screens still need implementation behind the prepared role boundaries.
- Admin schedule editor for doctor availability.
- Server Actions for booking, payment submission, slip upload, or slot locking.
- Thai QR generation and Slip Verification API integration.
- Zoom SDK integration for live consultations.
- File upload/storage integration for payment slips, prescriptions, PDFs, or attachments.
- Backend-backed Store, Community, Profile, broader doctor workflows beyond consultation lists, patient logs, and prescription writing, and pharmacist workflows beyond prescription verification and medicine preparation.
- Automated tests beyond lint/build/typecheck.

## Risk Notes

- Compliance requirements affect vendor selection and architecture
- Consultations, prescriptions, payment records, order records, shipment tracking, reward point adjustments, and images should be treated as sensitive records
- Ownership and role scope should be represented on the main entities without expanding the database beyond the agreed entity list unless needed
- AI features should wait until permissions, audit logging, and data boundaries are established
- Payments, prescriptions, and pharmacy fulfillment introduce additional regulatory and operational complexity

## Workspace Notes

- The workspace contains planning documentation and is initialized as a git repository
- Latest pushed planning commit: `18b9ab2 Document Stitch navigation plan`
- Application framework scaffold has started with Next.js 15, React 19, TypeScript, and Tailwind CSS
- Dependencies have been added through npm with `package-lock.json`
- Prisma has a placeholder MySQL schema only; domain models and migrations are deferred until the MVP entity boundary is confirmed
- Customer app routes currently redirect from `/` into the Stitch navigation shell at `/consult`
- Shared customer footer navigation is implemented with the final tabs: `Consult | Store | Community | Profile`
- Latest implemented frontend area: customer Consult flow from doctor list through advice log

## Next Recommended Step

The reviewed static Stitch customer screens are complete, the initial LINE LIFF/JWT plus Prisma user/session/staff profile foundation is in place with customer route protection, and the admin dashboard/user approval shell now has Prisma query/action boundaries plus local seed data. The first full domain schema foundation is also modeled in Prisma. Next recommended backend step: run the schema against a local MySQL database, seed the approval queue, then begin domain queries and admin scheduling behind role boundaries.

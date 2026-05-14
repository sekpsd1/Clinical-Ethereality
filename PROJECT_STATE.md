# Project State

## Project

Clinical Ethereality

## Phase

Backend authentication and user persistence foundation.

The project now contains a Next.js 15, React 19, TypeScript, and Tailwind CSS scaffold, the reviewed static customer Stitch screens, the first backend foundation for LINE LIFF authentication, Prisma-backed users/auth sessions, doctor/pharmacist profile models, JWT sessions, role/permission helpers, protected customer routes, and an initial role-protected admin dashboard shell. The customer UI remains static and unchanged; the backend foundation does not yet include Zoom SDK or full customer booking slot locking.

## Current Decisions

- Product category: clinical aesthetics commerce, consultation, pharmacy, and community web app
- Primary experience: authenticated platform for customers/patients, doctors, pharmacists, and admins
- Architecture pattern: modular monolith inside a single Next.js app
- Primary mutation pattern: Next.js Server Actions
- Server Action convention: new first-party mutations live in owning `features/*/actions.ts` modules, validate `FormData` with Zod before use, enforce session permissions before sensitive reads/writes, use Prisma transactions for multi-record changes, write audit logs for sensitive state transitions, and return shared typed form action state helpers from `lib/actions/server-actions.ts` for recoverable errors
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
- Local development access: `ENABLE_DEV_AUTH_BYPASS=true` enables `/api/auth/dev-session` and local customer/admin buttons on `/auth/line`; when seeded users are available, dev sessions use real Prisma user IDs so local write workflows can satisfy foreign-key constraints. This is disabled in production and does not replace LINE LIFF for MVP
- Admin foundation: `/admin` now has an admin-only shell and operational overview backed by Prisma counts for user approvals, consultations, payments, prescriptions, orders, inventory, and hidden community content when the database is available
- Admin user approvals: `/admin/users` now reads Prisma users with doctor/pharmacist profiles when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions with inline success/error feedback for approving staff roles and suspending users
- Staff invitation foundation: `/admin/users` now exposes invite links for doctor, pharmacist, and admin access requests; `/staff-invite/[role]` lets a signed-in LINE user submit a pending staff/admin access request without adding a new table, and the existing admin approval queue remains the review surface.
- Admin payment review foundation: `/admin/payments` now reads Prisma payment, order, customer, and item records when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions for manual PromptPay slip verification or rejection
- Admin order management foundation: `/admin/orders` now reads Prisma order, customer, item, payment, and shipment records when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions for moving orders through preparation, shipped, and delivered states
- Customer order tracking foundation: `/store/orders` now reads the signed-in customer's Prisma orders, items, latest payment, and latest shipment records, falls back to a DB-offline empty state, and shows a compact mobile order timeline without changing the existing Stitch store screens
- Customer checkout foundation: `/store/checkout` now submits through a customer-owned Server Action that creates Prisma order, order item, PromptPay payment-review, shipment placeholder, inventory reservation, and notification records before redirecting to `/store/orders`
- Admin product catalog foundation: `/admin/products` now reads Prisma product and inventory context when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions for creating and updating product catalog details, prices, prescription requirements, and product status
- Customer product browsing foundation: `/store` now reads active Prisma products with inventory context, preserves the reviewed Stitch marketplace layout, falls back to the existing static product list when the database is unavailable, and links product cards into data-backed detail pages
- Customer product detail foundation: `/store/[slug]` and `/store/paracetamol-500mg` now read active Prisma product and inventory context while preserving the reviewed Stitch detail layout, including prescription warning visibility and DB-offline fallback behavior
- Customer cart workflow foundation: `/store/cart` now provides a server-owned cookie cart with Prisma-backed product and inventory reads, quantity updates, clear-cart behavior, product-detail add-to-cart actions, and checkout submission using cart quantities before converting the cart into an auditable order/payment/shipment record
- Customer order-from-prescription foundation: `/store/prescriptions/[prescriptionId]` now reads a verified customer-owned prescription, lists active prescription-required products, creates a Prisma order with the selected product linked to `prescriptionId`, and redirects to customer order tracking
- Admin inventory management foundation: `/admin/inventory` now reads Prisma product and inventory records when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions for updating stock quantity and low-stock thresholds
- Admin moderation foundation: `/admin/moderation` now reads hidden and archived article/comment records when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions for restoring, hiding, or archiving community content
- Customer community article foundation: `/community/vitamin-c-tips` now reads a published Prisma article with visible comments and like counts, and includes customer-owned Server Actions for toggling article likes and creating visible comments
- Customer content reporting foundation: `/community/vitamin-c-tips` now includes customer report actions for articles and comments; reported content is moved to hidden moderation review, admin users receive in-app notifications, and `/admin/moderation` remains the review surface
- Admin notification foundation: `/admin/notifications` now reads recent Prisma notification records and active/pending recipients when a database is available, falls back to a DB-offline empty state, and includes admin-only Server Actions for sending in-app notifications
- Customer notification foundation: `/notifications` now reads the signed-in user's Prisma in-app notifications, keeps the Stitch notification layout, maps notification types back to existing app destinations, and includes a customer-owned mark-read Server Action
- Customer reward foundation: `/profile/rewards` now reads Prisma reward ledgers and user balances, checkout and community comments award points through shared rules, and customers can spend 50 points for a wellness credit with a reward notification
- Doctor consultation, patient log, and prescription writing foundation: `/doctor/consultations` and `/doctor/patients` now read Prisma consultation, patient, and prescription records scoped to the signed-in doctor profile when a database is available, fall back to DB-offline/profile-missing empty states, allow admins to view all doctor queues for operations support, and include a doctor/admin Server Action for submitting prescription notes to pharmacist verification
- Pharmacist prescription queue foundation: `/pharmacist/prescriptions` now reads Prisma prescription, patient, doctor, consultation, and linked order-item records when a database is available, falls back to a DB-offline empty state, and includes pharmacist/admin Server Actions for manual prescription verification or rejection
- Pharmacist medicine preparation foundation: `/pharmacist/orders` now reads paid, preparing, and shipped order queues with customer, payment, shipment, and item context when a database is available, falls back to a DB-offline empty state, and includes pharmacist/admin Server Actions for moving orders through preparation, shipped, and delivered states
- Audit metadata foundation: Prisma now includes an `AuditLog` model and `/admin/audit` review screen; sensitive checkout, payment, fulfillment, prescription, moderation, inventory, product, reward, and staff-account actions write role-aware audit entries with entity metadata
- Admin schedule editor foundation: Prisma now includes `DoctorAvailability`, and `/admin/schedules` lets admins add, view, activate, or pause approved doctor availability slots with audit logging
- Customer booking slot integration: `/consult/booking/somchai` now reads active `DoctorAvailability` slots for the approved seed doctor and creates a pending-payment consultation from the selected slot before redirecting to consultation payment
- Customer appointment detail foundation: `/consult/appointments/[consultationId]` now reads Prisma consultation data scoped to the signed-in customer, shows doctor, scheduled date/time, consultation status, fee, and routes the next CTA to consultation payment, waiting room, advice log, or rebooking based on status
- Consultation payment status foundation: `/consult/payment?consultation=...` now reads the signed-in customer's Prisma consultation, generates PromptPay QR instructions from the configured PromptPay ID, submits slip QR payload or hosted slip image URL through the provider-neutral SlipOK/EasySlip client, moves verified consultations to `scheduled`, and shows rejected/provider-error states without adding a new payment schema
- Customer prescription status foundation: `/consult/prescriptions` now reads Prisma prescriptions scoped to the signed-in customer, shows doctor/pharmacist context, verification status, linked medicine order context, and next-step CTAs for advice log, store browsing, or order tracking
- Prescription-required purchase guard: prescription-required product details now route customers to verified prescription status instead of direct cart add, and normal checkout rejects prescription-required cart products unless they are ordered through the verified prescription flow
- Local seed data: `prisma/seed.mjs` creates development admin, customer, pending/approved doctor and pharmacist, suspended customer, products, inventory, consultation, prescription, order, payment, shipment, moderation, notification, and reward records for testing admin queues
- Staff profile persistence: Prisma includes `Doctor` and `Pharmacist` profile models linked one-to-one with `User`, with license, status, approval, and basic workflow metadata
- Domain schema foundation: Prisma now includes consultation, prescription, product, inventory, order, order item, payment, shipment tracking, article, comment, like, notification, and reward point models with core status enums, ownership relations, and indexes
- Database migration foundation: Prisma initial migration `20260513120000_init` now captures the current MySQL schema for auth, staff profiles, consultations, prescriptions, commerce, inventory, payments, shipments, community, notifications, and reward records
- Initial role assignment: LINE LIFF sessions default to `customer`; doctor, pharmacist, and admin roles remain reserved for the future invitation/approval flow
- Permission enforcement direction: reusable server helpers in `lib/permissions/*` should be called from Server Actions and route handlers before sensitive reads or writes
- Integration route placeholders: `/api/auth/line/callback`, `/api/webhooks/payments`, and `/api/webhooks/zoom` now exist as guarded placeholders; payment and Zoom persistence remain intentionally unimplemented until providers are selected
- Recommended video call integration: Zoom SDK
- Recommended payment approach: Thai QR plus automatic Slip Verification API using either SlipOK or EasySlip with API-key authentication
- Slip verification provider decision: the system should support SlipOK or EasySlip through environment configuration; provider-specific API keys, SlipOK branch ID, expected receiver name, and endpoint overrides must stay in environment variables and never be committed
- Slip verification API boundary: `/api/payments/verify-slip` accepts a payment ID plus QR payload or image URL, enforces customer ownership/admin payment-review permission, calls the configured provider client, updates payment/order status, and creates an in-app payment notification
- Customer slip verification UI: `/store/orders` now exposes a customer-owned slip verification panel for pending payments; it accepts a slip image, attempts local QR extraction with the browser Barcode Detector API, falls back to pasted QR payload or hosted slip image URL, and submits to `/api/payments/verify-slip` without introducing a storage provider decision
- Thai QR payment instruction foundation: `/store/checkout` now generates a dynamic PromptPay EMV QR payload for the order amount when `THAI_QR_PROMPTPAY_ID` is configured, stores the payload on the Prisma payment record, and `/store/orders` renders the saved QR/payment payload beside slip verification instructions
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
- Consultation PromptPay checkout: implemented at `/consult/payment` with customer-scoped consultation reads, PromptPay QR generation, and SlipOK/EasySlip verification status handling
- Waiting room: implemented at `/consult/waiting-room`
- Live consultation: implemented at `/consult/live`
- Advice log: implemented at `/consult/advice-log`
- Prescription verification status: implemented at `/consult/prescriptions`

Store:

- Health marketplace: implemented at `/store`
- Product detail: implemented at `/store/paracetamol-500mg`
- Store checkout: implemented at `/store/checkout`
- Payment success and tracking: implemented at `/store/payment-success`
- Customer order list and tracking: implemented at `/store/orders` as a supporting data-backed screen
- Order from prescription: implemented at `/store/prescriptions/[prescriptionId]`
- Customer checkout submission: implemented from `/store/checkout` into Prisma order/payment/shipment records

Community and Profile:

- User profile: implemented at `/profile`
- Reward points ledger: implemented at `/profile/rewards`
- Community hub: implemented at `/community`
- Create new post: implemented at `/community/create`
- Article/post detail and comments: implemented at `/community/vitamin-c-tips`
- Article likes and comments: implemented at `/community/vitamin-c-tips` through Prisma-backed Server Actions
- Notification center: implemented at `/notifications` and backed by customer-owned Prisma in-app notifications
- Community search results: implemented at `/community/search`

Admin:

- Admin dashboard shell: implemented at `/admin` as a role-protected static operational overview
- Admin user and role approvals: implemented at `/admin/users` as a role-protected Prisma-backed approval queue with DB-offline fallback
- Admin payment review: implemented at `/admin/payments` as a role-protected Prisma-backed PromptPay review queue with manual verify/reject actions
- Admin order management: implemented at `/admin/orders` as a role-protected Prisma-backed fulfillment queue with manual preparation/shipped/delivered actions
- Customer order tracking: implemented at `/store/orders` as an authenticated Prisma-backed customer order list with payment and shipment timeline context
- Customer checkout foundation: implemented at `/store/checkout` with a guarded Server Action that creates pending payment-review order records
- Admin product catalog: implemented at `/admin/products` as a role-protected Prisma-backed catalog management screen with create/update actions
- Admin inventory management: implemented at `/admin/inventory` as a role-protected Prisma-backed stock queue with manual quantity and threshold updates
- Admin moderation: implemented at `/admin/moderation` as a role-protected Prisma-backed community content queue with restore/hide/archive actions
- Admin notifications: implemented at `/admin/notifications` as a role-protected Prisma-backed in-app notification sender and recent-notification review queue
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
- Choose final Slip Verification API provider: SlipOK or EasySlip
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
- SlipOK/EasySlip verification API boundary
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
- Customer booking integration: `/consult/booking/somchai` keeps the reviewed booking layout while replacing static time buttons with active doctor availability slots from Prisma and a guarded Server Action that creates a pending-payment consultation.
- Customer appointment detail: `/consult/appointments/[consultationId]` adds the supporting booking confirmation/detail screen after a slot is booked, scoped to the signed-in customer and linked from consultation notifications.
- Customer consultation payment verification: `/consult/payment?consultation=...` now verifies consultation payment slips with the configured SlipOK/EasySlip provider and moves verified appointments into the waiting-room path.
- Customer prescription status: `/consult/prescriptions` adds the supporting status screen for pharmacist verification and linked medicine order context, with notifications from doctor submission and pharmacist review.
- Customer order from prescription: `/store/prescriptions/[prescriptionId]` lets customers convert a verified prescription into a linked medicine order while preserving payment, shipment, reward, inventory reservation, and audit behavior.
- Waiting room: `/consult/waiting-room`, implemented from Figma with payment-confirmed status, countdown, doctor brief, preparation checklist, camera/mic test CTA, and join consultation CTA.
- Live consultation: `/consult/live`, implemented from Stitch zip reference with compact video shell, chat transcript, prescription attachment, composer, and end-call CTA.
- Advice log: `/consult/advice-log`, implemented from Stitch zip reference with doctor summary, medical note, prescription list, attachment, order medicine CTA, and PDF download CTA.
- Store health marketplace: `/store`, implemented from Stitch zip reference with custom marketplace header, search field, cart indicator, category cards, recommended product cards, and local product imagery.
- Store product detail: `/store/paracetamol-500mg`, implemented from Stitch zip reference with custom detail header, product hero, prescription-required warning, advice log selector, description card, and sticky buy CTA.
- Store checkout: `/store/checkout`, implemented from Stitch zip reference with order item cards, PromptPay QR payment summary, slip upload area, delivery address, and payment confirmation CTA.
- Store checkout submission: `/store/checkout` now uses a customer-scoped Server Action to create Prisma order, order item, payment, shipment, inventory reservation, and notification records, then redirects to `/store/orders`.
- Store payment success and tracking: `/store/payment-success`, implemented from Stitch zip reference with slip verification result, pharmacy preparation timeline, main-store return action, and pharmacy sync badge.
- Customer order tracking: `/store/orders` adds a supporting customer-owned Prisma-backed order list with payment state, shipment state, tracking number, and status timeline; `/store/payment-success` links into it.
- User profile: `/profile`, implemented from Stitch zip reference with custom profile header, teal verified member hero, advice/posts stats, settings menu rows, logout action, and app version note.
- Reward points ledger: `/profile/rewards` establishes a customer-owned points balance and ledger view with earn/spend rules, a 50-point wellness credit redemption action, and DB-offline/empty states.
- Community hub: `/community`, implemented from Stitch zip reference with custom community header, search field, verified featured content card, category chips, and community feed cards.
- Create new post: `/community/create`, implemented from Stitch zip reference with custom compose header, topic/content inputs, image upload area, category selector chips, post CTA, and terms note.
- Article detail and comments: `/community/vitamin-c-tips`, implemented from Stitch zip reference with fixed detail header, hero article image, glass content card, interaction bar, comment list, and sticky comment composer.
- Article detail backend: `/community/vitamin-c-tips` now reads the published Prisma article seeded under `vitamin-c-tips`, renders visible comments and like counts, and supports customer like/comment Server Actions.
- Notification center: `/notifications`, implemented from Stitch zip reference with custom notification header, latest updates heading, unread notification glow, read cards, and Prisma-backed customer in-app notification records with mark-read actions.
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
- Customer order tracking: `/store/orders` establishes the first customer-facing commerce read model with user-scoped order, item, payment, and shipment data plus DB-offline and empty states.
- Customer checkout foundation: `/store/checkout` establishes the first customer-facing commerce write path with permission enforcement, Prisma transaction boundaries, payment-review records, inventory reservation, and notification creation.
- Slip verification boundary: `/api/payments/verify-slip` establishes a provider-neutral route and client for SlipOK/EasySlip automatic slip checks using API keys, normalized verification results, and guarded payment/order updates.
- Customer slip verification UI: `/store/orders` now lets customers submit pending payment slips through the provider-neutral verification boundary using automatic local QR extraction when available, manual QR payload fallback, or hosted slip image URL fallback.
- Thai QR payment instructions: checkout and customer order tracking now use a generated PromptPay EMV payload and QR image for the exact order amount when `THAI_QR_PROMPTPAY_ID` is present; new orders remain pending payment until the customer submits a slip for verification.
- Admin product catalog: `/admin/products` establishes data-backed product catalog create/update actions for name, slug, description, image URL, price, prescription requirement, and status.
- Customer product browsing: `/store` now renders active Prisma products with inventory availability labels and provider-safe fallback content without redesigning the Stitch marketplace.
- Customer product details: `/store/[slug]` now renders active Prisma product detail data, with `/store/paracetamol-500mg` kept as a compatible existing route.
- Customer cart workflow: `/store/cart` now supports product-detail add-to-cart, cart quantity updates, clearing the cart, and checkout from cookie-cart contents into the existing Prisma order creation path.
- Admin inventory management: `/admin/inventory` establishes the first data-backed stock queue with product/inventory context and guarded stock update Server Actions.
- Admin moderation: `/admin/moderation` establishes the first data-backed community safety queue with article/comment context and guarded restore, hide, and archive Server Actions.
- Customer article interactions: `/community/vitamin-c-tips` establishes the first customer-facing community write path for article likes and comments with permission enforcement and revalidation.
- Customer content reporting: `/community/vitamin-c-tips` lets customers report articles and comments into the existing admin moderation queue without adding a separate reporting schema.
- Admin notifications: `/admin/notifications` establishes the first data-backed notification sender with active/pending recipient selection and recent notification review.
- Customer notifications: `/notifications` establishes the first customer data-backed notification center with user-scoped Prisma reads, DB-offline fallback, existing destination mapping, and a guarded mark-read Server Action.
- Customer rewards: `/profile/rewards` establishes the first reward-points read/write path with shared earning rules for orders and comments, spending rules for wellness credit redemption, balance updates, ledger entries, and notification creation.
- Doctor consultations: `/doctor/consultations` establishes the first doctor back-office queue with doctor-scoped consultation/patient/prescription context, DB-offline/profile-missing fallbacks, and guarded prescription note submission to pharmacist verification.
- Doctor patient logs: `/doctor/patients` establishes doctor-scoped patient history summaries from assigned consultations and prescriptions.
- Pharmacist prescriptions: `/pharmacist/prescriptions` establishes the first pharmacist back-office queue with prescription/patient/doctor/consultation context and guarded verify/reject Server Actions.
- Pharmacist medicine preparation: `/pharmacist/orders` establishes the first pharmacist fulfillment queue with paid/preparing/shipped orders and guarded preparation, shipment, and delivery status update Server Actions.
- Audit trail: `/admin/audit` lists recent sensitive action logs for admins, backed by the new Prisma `AuditLog` model and shared audit writer used by payment, order, prescription, moderation, inventory, product, reward, and user-management actions.
- Admin schedule editor: `/admin/schedules` provides an admin-only doctor availability editor for approved doctors, including weekday/time ranges, slot length, active/inactive status, and audit records for schedule changes.
- Permission foundation: reusable role and permission helpers live in `lib/permissions/*` for future Server Actions, route handlers, and domain services.
- Server Action convention helper: `lib/actions/server-actions.ts` now centralizes form action state, `FormData` conversion, and success/error helpers for new feature actions; the admin product catalog action has been migrated as the first reference implementation.
- Customer footer navigation consistency: customer app screens now use the shared `FooterNav` with final labels `Consult | Store | Community | Profile`; consult payment, waiting room, prescription status, and advice log keep `Consult` active through the shared footer, notification center remains a sub-screen without a root active tab, and live consultation hides the footer to reduce distraction.
- Mobile LINE LIFF viewport verification: browser checks against `http://localhost:3001` covered the customer consult, consultation payment, waiting room, live consultation, advice log, prescription status, store, product detail, cart, checkout, order tracking, community, article detail, create post, search, notifications, profile, and rewards routes. The pass confirmed no visible app errors, shared footer availability on customer routes, fixed action controls clearing the footer on representative product/article screens, and live consultation remaining footer-free.
- Playwright smoke test foundation: `playwright.config.ts` and `tests/e2e/smoke.spec.ts` now run Pixel 5-sized smoke coverage for customer app routes, live consultation footer hiding, and admin/doctor/pharmacist role routes through the local dev auth bypass. `npm run test:e2e` passed with 21 smoke tests.
- Protected workflow integration test foundation: `tests/e2e/protected-workflows.spec.ts` now verifies unauthenticated customer and staff redirects preserve return paths, customers cannot enter admin/doctor/pharmacist workflows, doctor and pharmacist route boundaries stay separate, admins can support doctor/pharmacist queues, and sensitive slip verification rejects unauthenticated API calls. The targeted Playwright pass covered 6 protected workflow tests.
- Preview deployment configuration foundation: `vercel.json` now defines the Vercel Next.js build/install/output settings, Singapore region, and safe default auth/session environment values for hosted previews; `package.json` runs `prisma generate` after install so Prisma Client is available during Vercel builds; `DEPLOYMENT.md` documents preview, staging, production, health-check, and sensitive-environment requirements.
- Staging environment configuration foundation: `STAGING.md` now defines the staging purpose, required isolated services, environment rules, database workflow, release checklist, and production promotion gates; `.env.staging.example` provides a non-secret staging variable checklist with dev auth disabled and dedicated staging placeholders.
- Production environment configuration foundation: `PRODUCTION.md` now defines launch gates, required production services, environment rules, deployment checks, data protection rules, rollback handling, and post-launch checks; `.env.production.example` provides a non-secret production variable checklist with dev auth disabled and production-only placeholders.
- Backup and restore readiness foundation: `BACKUPS.md` now defines environment-specific backup policy, database backup checklist, restore drill, object-storage backup checklist, incident restore procedure, recommended RPO/RTO targets, and production launch gates for backups before patient-like records are entered.
- Error monitoring foundation: Sentry Next.js monitoring is wired through `instrumentation.ts`, `instrumentation-client.ts`, server and edge Sentry config files, and `withSentryConfig` in `next.config.ts`; monitoring stays disabled until environment DSNs are configured, source-map uploads are gated by `SENTRY_AUTH_TOKEN`, and default PII capture remains disabled for privacy-sensitive workflows.
- Compliance review foundation: `/admin/compliance` now gives admins a production-readiness checklist covering PDPA/legal inputs, health-data consent, access controls, audit/backup/monitoring, clinical/pharmacy SOPs, payment credentials, and fulfillment requirements before real patient-like records are enabled.
- Staff invite flow: `/staff-invite/doctor`, `/staff-invite/pharmacist`, and `/staff-invite/admin` create pending review requests from authenticated LINE users, preserve admin approval as the final gate, and write audit metadata for invite requests.
- Community card primitives: `ArticleCard` and `CommunityPostCard` now extract the existing Stitch community/search card treatments into reusable components without changing finalized layouts.
- Comment composer primitive: `CommentComposer` now extracts the existing Stitch article comment input treatment into a reusable form composer while preserving the article detail layout.
- Profile settings support: `/profile/settings` adds an authenticated customer settings support screen using the new `BottomSheet` primitive, linked from the existing profile gear control without changing finalized profile layout.
- Profile support screens: `/profile/saved-articles` and `/profile/shipping-addresses` add customer-facing support screens from the existing profile rows, keeping saved content and shipping placeholders behind authenticated customer routes until real client data is available.
- Customer order detail support: `/store/orders/[orderId]` adds an authenticated customer order detail screen from the existing customer order tracking data and handles unknown IDs without exposing unrelated records.
- Permission unit test foundation: `vitest.config.ts` and `tests/unit/permissions.test.ts` now cover supported role detection, role-permission matrix expectations, admin permission coverage, assertion failures, own-record reads, and assigned-record reads. `npm run test:unit` passed with 27 tests.
- Stitch UI primitive test foundation: `tests/unit/ui-primitives.test.tsx` now covers shared glass surfaces, semantic status badge tone classes, final customer footer labels and active nested routes, live-consultation footer hiding, and placeholder composition with shared primitives. `vitest.config.ts` includes a narrow TSX transform for component imports while preserving the Next.js `jsx: preserve` compiler setting.
- Static assets copied into `public/images/doctors`, `public/images/profiles`, and `public/images/payments`.
- Local database verification: local MySQL schema `clinical_ethereality` was pushed and seeded with `npm run db:push` and `npm run db:seed` using the project-owned Docker MySQL container `clinical-ethereality-db` on `127.0.0.1:3307`.
- Verification passed after the latest changes: `npm run lint`, `npm run build`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, and `npx prisma validate` with the local `DATABASE_URL` loaded from `.env.local`.
- Local dev server was restarted cleanly at `http://localhost:3001`.

Known frontend caveats:

- Consult screens are still mostly static, except booking availability and appointment detail now read Prisma consultation data.
- Store marketplace and product detail now use Prisma-backed product data with fallback content.
- Some deep-flow screens intentionally use custom headers based on Stitch references, while customer bottom navigation is centralized through the root `FooterNav` except for live consultation.
- `LiveConsultation` and `AdviceLog` were refined from Stitch `.zip` exports, not live Figma MCP, because the Starter plan MCP read quota was exhausted.
- Running `next build` while `next dev` is active can corrupt `.next` dev chunks on this Windows setup. After builds, stop dev server, clear `.next`, and restart `npm run dev -- -p 3001`.

Not implemented yet:

- Business-domain queries beyond the current admin, doctor, pharmacist, customer notification, customer order tracking, and customer article interaction foundations.
- Domain service coverage has started with shared order fulfillment transitions for admin and pharmacist workflows; additional services should be added as more sensitive workflows are implemented.
- Reusable mobile layout primitives now include `Screen`, `SafeArea`, `Button`, `IconButton`, `TextField`, `SearchField`, `EmptyState`, `PaymentStatusBadge`, `OrderTrackingTimeline`, `NotificationItem`, `ProfileSettingsItem`, `ArticleCard`, `CommunityPostCard`, `CommentComposer`, and `BottomSheet`; continue extracting unchecked Stitch primitives without redesigning finalized screens.
- Broader data-backed management screens, doctor screens, and pharmacist screens still need implementation behind the prepared role boundaries.
- Broader booking integration still needs formal slot locking beyond the current duplicate scheduled-time guard; admin doctor availability editing and customer-facing availability reads are implemented.
- Full slip upload storage and formal slot locking.
- Production PromptPay requires `THAI_QR_PROMPTPAY_ID` to be configured securely; dynamic Thai QR payload generation is implemented for store checkout orders.
- Production consultation payment verification requires `SLIP_VERIFICATION_PROVIDER`, `SLIP_VERIFICATION_API_KEY`, and provider-specific values such as `SLIPOK_BRANCH_ID` to be configured securely.
- Zoom SDK integration for live consultations.
- File upload/storage integration for payment slips, prescriptions, PDFs, or attachments.
- Broader Community/Profile data beyond the current article interaction and reporting flows, broader doctor workflows beyond consultation lists, patient logs, and prescription writing, and pharmacist workflows beyond prescription verification and medicine preparation.
- Automated tests beyond the current permission unit coverage, Stitch UI primitive coverage, protected workflow integration coverage, Playwright smoke coverage, lint, build, and typecheck.

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

Phase 12 quality work is complete, and the staff invitation foundation is now in place. Permission unit tests, reusable Stitch UI primitive tests including `Screen`/`SafeArea`, form/button/empty-state primitives, order payment/tracking primitives, notification/profile row primitives, community card primitives, the comment composer primitive, and the bottom sheet primitive, order fulfillment service tests, protected workflow integration tests, footer/navigation checks, mobile LINE LIFF viewport smoke coverage, Playwright smoke tests, Vercel preview deployment configuration, staging environment configuration, production environment launch gates, backup/restore readiness plans, Sentry error monitoring wiring, and admin compliance readiness review are in place. Next recommended step: collect the remaining client intake items or tackle credential-dependent MVP gaps such as Zoom SDK integration, file storage, real LINE LIFF channel configuration, and production payment verification.

# Tasks

## Phase 0: Planning

- [x] Define project purpose
- [x] Define target users
- [x] Define customer, doctor, pharmacist, and admin roles
- [x] Define core features
- [x] Recommend tech stack
- [x] Outline database needs
- [x] Outline authentication system
- [x] Define admin dashboard requirements
- [x] Define deployment strategy
- [x] Define system architecture
- [x] Define recommended folder structure
- [x] Define database schema proposal
- [x] Define API structure
- [x] Define development phases
- [x] Define MVP scope
- [x] Define Stitch-based design system architecture
- [x] Define Tailwind theme structure
- [x] Define reusable component plan
- [x] Define UI component naming convention
- [x] Define frontend state management approach
- [x] Review Stitch Consult screens
- [x] Review Stitch Store screens
- [x] Review Stitch Community/Profile screens
- [x] Define final footer navigation
- [x] Define Stitch screen inventory
- [x] Define supporting screens to add only as needed
- [x] Create client intake checklist
- [x] Create planning documentation

## Phase 0.5: Client Intake

- [x] Receive Thai PDPA Privacy Policy draft
- [x] Receive Thai Terms of Service draft
- [x] Receive health-data, teleconsultation, prescription, and pharmacy consent wording
- [x] Receive company name, tax ID, billing address, parcel sender address, and support contact
- [x] Receive doctor bio, education, specialty, license number, consultation fee, schedule, supported consult modes, and official profile photo; exact license values and documents stay outside git
- [x] Finalize pre-doctor assessment recommendation mapping with the received real doctor profile; 4 Stitch export pages, persistence, 7-day reuse, booking attachment, doctor-visible summary, and recommended doctor handoff are implemented
- [ ] Receive the completed structured product catalog using `PRODUCT_CATALOG_TEMPLATE.csv`, including category, short/full descriptions, prices, images, stock, prescription-required flags, warnings, storage rules, and FDA status/numbers; the client-ready request guide is in `CLIENT_PRODUCT_DATA_REQUEST.md`
- [x] Approve the 10 received HPV/STIs home-test and self-swab seed products as the first Client UAT catalog, allowing corrections after client review; confirmed UAT inputs are the package variants, prices, two received product images, VAT/shipping note, and non-prescription direction, while stock `500`, low-stock threshold `50`, FDA-pending wording, usage, warnings, storage, fulfillment notes, and other application-derived mappings are not approved Production facts
- [x] Confirm clinic-as-pharmacy MVP operations: a doctor-issued prescription can be ordered immediately without a pharmacist approval gate; Admin staff prepare medicine, pack, ship, and record fulfillment statuses, while the Pharmacist role remains available as read-only operational context
- [x] Update in-app doctor-issued prescription ordering so customers can buy prescription-required products without an additional pharmacist/document verification gate while preserving prescription, order, payment, shipment, reward, inventory, and audit linkage
- [x] Add external prescription attachment metadata foundation and upload UX stub for prescription-required purchases using owner-managed storage URLs, order linkage, attachment visibility, and audit logs without storing file bytes in the database
- [x] Add in-app consultation chat foundation that is not LINE chat, with persisted Prisma/MySQL messages, consultation access checks, audit logs, notifications, live consult UI binding, and latest-message visibility in the doctor queue
- [x] Add owner-managed integration readiness panel for PromptPay, EasySlip/SlipOK, storage, LINE LIFF, and Zoom without exposing secret values
- [x] Add file storage foundation for Cloudinary/S3 readiness, hosted URL base validation, storage key extraction, and external prescription metadata without storing file bytes in the database; payment slips now use completed private Plesk storage
- [x] Draft prescription verification, medicine preparation, and shipment SOP flows for client review
- [x] Confirm PromptPay phone/tax ID intake; secure production payment configuration remains owner-managed through environment secrets
- [ ] Configure SlipOK Branch ID/API key securely as owner-managed setup, approve `log=true` privacy handling, and complete a separately approved Controlled Real-slip UAT. OK BASIC is limited to 100 slips/month; upgrade to OK Start before exceeding the quota.
- [x] Implement SlipOK private-file adapter locally: private `FileAttachment.storageKey` bytes are handed to SlipOK as multipart `files` with Payment amount and `log=true`, never as a public/Drive URL or local path; normalize only the required response fields and fail closed on duplicate/mismatch/outage/auth/quota/network errors. No real provider request was made and activation remains blocked on credentials, privacy approval, and controlled real-slip UAT.
- [x] Connect the customer-owned Consultation private-slip UI to provider verification: a validated attached `FileAttachment` is read only on the server, claimed with a compare-and-swap retry cooldown, and sent as private bytes to SlipOK; only a verified result moves `pending_payment` consultations to `scheduled`. Provider failures leave the consultation pending, Admin has no manual verification path, and Local Chromium mock-provider UAT at `390×844` passed upload, `pending_review`, verified scheduling, private owner/admin access, cross-owner `404`, anonymous `401`, audit/notification counts, and fixture/file cleanup.
- [x] Add MVP private Plesk payment-slip storage for Store and Consultation: browser upload is limited to JPG/PNG/WebP up to 5 MB, server magic-byte validation writes only under absolute `PAYMENT_UPLOAD_DIR`, bytes remain outside the deployment root, and reads require authenticated owner or Admin payment-review permission. Private uploads enter `pending_review`, retain audit/notification/idempotency/transaction-reference boundaries, and do not call SlipOK/EasySlip. Chromium Playwright Local UAT at `390×844` passed Store/Consultation upload, owner/admin/private access, cross-owner `404`, anonymous `401`, retry idempotency, stock preservation, Console/HTTP-500 checks, and fixture/file cleanup.
- [x] Complete Controlled Local SlipOK Real-slip UAT for Store and Consultation with separate owner-controlled low-value transfers. Store and Consultation each passed private browser upload, provider verification, amount/receiver/reference validation, normalized-reference uniqueness, retry blocking, access boundaries, audit/notification checks, and cleanup. This supersedes earlier mock-only/no-real-provider notes; Production remains blocked on Plesk configuration, privacy approval for `log=true`, and separately approved Production UAT.
- [x] Approve and document the Community rules, four existing article categories, five existing report reasons, post-moderation policy, Before/After prohibition, review SLA, support-channel appeals, and 2,555-day audit target in `COMMUNITY_LAUNCH_POLICY.md`
- [x] Complete Community Production operational readiness: verified `COMMUNITY_UPLOAD_DIR` as an absolute private path outside the deployment directory with least-privilege access and Node write access; completed a private Google Drive backup/restore hash drill; assigned Admin Media design moderation ownership (10:00/16:00 ICT business-day checks), the normal Support appeal path, and the approved SLA; and completed controlled `[UAT]` Production Community UAT without deleting Audit/Report history. Plesk-native restore-to-temp remains a future hardening item.
- [x] Confirm Stitch source/tokens/assets are owner-managed; use owner-provided HTML exports for any new screens

## Phase 1: Project Scaffolding And Frontend Foundation

- [x] Initialize git repository
- [x] Scaffold Next.js 15 app with React 19 and TypeScript
- [x] Add Tailwind CSS
- [x] Import or document the finalized Stitch specification
- [x] Map Stitch tokens into Tailwind theme structure
- [x] Define Stitch-based design tokens in `lib/design-system/tokens.ts`
- [x] Define Stitch variants in `lib/design-system/variants.ts`
- [x] Define reusable component contracts from Stitch
- [x] Define persistent shared `FooterNav` with `Consult`, `Store`, `Community`, and `Profile`
- [x] Define photography usage rules from Stitch
- [x] Define low-modal interaction patterns based on Stitch
- [x] Add lucide-react
- [x] Add formatting and linting
- [x] Add Prisma
- [x] Configure MySQL connection
- [x] Establish Next.js Server Actions conventions
- [x] Create recommended folder structure
- [x] Create `components/ui`, `components/layout`, and `components/navigation`
- [x] Create `lib/design-system`
- [x] Create initial app layout
- [x] Create protected app route group
- [x] Create public auth route handlers for LINE session exchange, session refresh, current session, and logout
- [x] Create webhook route handler placeholders

## Phase 2: Authentication And Authorization

- [x] Confirm LINE Mini App/LINE LIFF as the required customer entry path
- [x] Confirm no standalone customer email/password or guest access for MVP
- [x] Add local-only development auth bypass for previewing customer and admin screens
- [x] Configure LINE LIFF channel
- [x] Implement LINE LIFF client login entrypoint
- [x] Implement LINE LIFF ID-token verification endpoint
- [x] Implement LINE Login OAuth callback for desktop browser authentication
- [x] Implement JWT issuing and validation
- [x] Implement persisted JWT refresh token revocation or re-authentication strategy
- [x] Implement initial JWT refresh endpoint
- [x] Refresh expired protected-route access tokens transparently in middleware, rotate refresh tokens with compare-and-swap and concurrent-request retry protection, preserve the exact path/query, and keep role-safe destinations for customer, doctor, pharmacist, and admin
- [x] Make server-side role guards accept a route-specific LINE Login return path instead of hard-coding `next=/admin`; middleware forwards the exact protected path/query to server rendering, while role guards retain safe role-home fallbacks for actions and non-routed calls
- [x] Implement logout
- [x] Implement session handling
- [x] Add versioned legal and consent acceptance records
- [x] Implement doctor, pharmacist, and admin invitation flow
- [x] Define customer, doctor, pharmacist, and admin roles
- [x] Add initial route-level role boundaries for doctors, pharmacists, and admins
- [x] Add permission helpers
- [x] Protect customer app routes
- [x] Add initial patient-only route boundary through authenticated customer routes
- [x] Add doctor access boundaries for assigned patients
- [x] Add initial pharmacist access boundaries for prescriptions
- [x] Document initial auth and permission decisions in `PROJECT_STATE.md`

## Phase 3: Database Foundation

- [x] Model users
- [x] Model auth sessions
- [x] Model doctors
- [x] Model pharmacists
- [x] Model consultations
- [x] Model prescriptions
- [x] Model products
- [x] Model inventory
- [x] Model orders
- [x] Model order_items
- [x] Model payments
- [x] Model shipment_tracking
- [x] Model articles
- [x] Model comments
- [x] Model likes
- [x] Model notifications
- [x] Model reward_points
- [x] Add all enums for roles, statuses, payment states, and reward point directions
- [x] Add initial auth enums for user role, account status, and auth session status
- [x] Add staff profile status enum
- [x] Add all indexes and unique constraints from schema proposal
- [x] Add initial auth indexes and unique LINE user constraint
- [x] Add initial doctor/pharmacist user and license constraints
- [x] Add migrations
- [x] Add seed data for local development

## Phase 3.5: API And Domain Structure

- [ ] Create feature action files
- [ ] Create feature query files
- [x] Create domain service files
- [x] Create Zod validation schemas
- [x] Create permission helpers
- [x] Add route handlers for LINE callback, payment webhook, Zoom webhook, and health check

## Phase 4: Reusable UI Component System

- [x] Build `AppShell`
- [x] Build `Screen`
- [x] Build `SafeArea`
- [x] Build `FooterNav`
- [x] Build `TopBar`
- [x] Build `GlassSurface`
- [x] Build `Button`
- [x] Build `IconButton`
- [x] Build `TextField`
- [x] Build `SearchField`
- [x] Build `StatusBadge`
- [x] Build `BottomSheet`
- [x] Build `EmptyState`
- [x] Build `DoctorCard`
- [x] Build `BookingCalendar`
- [x] Build `TimeSlotButton`
- [x] Build `PromptPayQrPanel`
- [x] Build `SlipUploadBox`
- [x] Build `PaymentStatusBadge`
- [x] Build `OrderTrackingTimeline`
- [x] Build `CommunityPostCard`
- [x] Build `ArticleCard`
- [x] Build `CommentComposer`
- [x] Build `NotificationItem`
- [x] Build `ProfileSettingsItem`
- [x] Build reusable domain cards and rows from Stitch patterns

## Phase 5: Consult Stitch Screens

- [x] Build doctor list screen
- [x] Build doctor profile and booking screen
- [x] Integrate customer booking screen with doctor availability slots
- [x] Add formal booking slot locking with a database-level slot lock and booked-slot UI state
- [x] Add booking slot lock release rules for expired pending-payment holds and orphan locks
- [x] Build consultation PromptPay checkout screen
- [x] Add consultation payment status polish for pending, verified, rejected, expired, and closed payment states
- [x] Extract consultation payment verification transitions into a tested consultation payment domain service
- [x] Build consultation waiting room screen
- [x] Build live consultation screen shell
- [x] Build advice log screen
- [x] Add booking confirmation supporting screen if needed
- [x] Add payment pending/rejected supporting screens if needed
- [x] Add appointment detail supporting screen if needed
- [x] Add prescription verification status supporting screen if needed

## Phase 6: Store Stitch Screens

- [x] Build health marketplace screen
- [x] Build product detail screen
- [x] Build store checkout screen
- [x] Build payment success and tracking screen
- [x] Add order from prescription supporting screen if needed
- [x] Add order detail supporting screen if needed
- [x] Validate prescription-required purchase flow

## Phase 7: Community And Profile Stitch Screens

- [x] Build user profile screen
- [x] Connect the customer profile name, LINE avatar, member status, completed consultation count, published post count, and account settings to authenticated Prisma data
- [x] Allow authenticated customers to update their own email and phone with validation, permission checks, and audit logging
- [x] Build community hub screen
- [x] Build create post screen
- [x] Build article/post detail and comments screen
- [x] Build notification center screen
- [x] Build community search results screen
- [x] Add saved articles supporting screen if needed
- [x] Add shipping addresses supporting screen if needed
- [x] Add settings supporting screen if needed
- [x] Add Thai customer profile, settings, and rewards polish

## Phase 8: Admin Dashboard

- [x] Build authenticated dashboard shell
- [x] Add admin navigation foundation
- [x] Use dedicated admin persistent navigation
- [x] Add role-aware admin route visibility
- [x] Add Thai staff/admin copy cleanup for notifications, moderation, products, and admin navigation
- [x] Add static new users and role approvals module
- [x] Add static pending consultations module
- [x] Add static prescriptions awaiting verification module
- [x] Add static orders awaiting preparation module
- [x] Add static payments pending review module
- [x] Add static low-stock inventory module
- [x] Add static reported community content module
- [x] Add static recent patient and order activity module
- [x] Connect admin dashboard modules to Prisma queries
- [x] Build static admin user and role approval management screen
- [x] Connect admin user and role approval screen to Prisma query structure
- [x] Add admin role approval and user suspension Server Action boundaries
- [x] Add inline success/error feedback for admin role approval actions
- [x] Filter the Admin personnel screen to staff only and add pending/approved/inactive tabs, name/LINE ID search, database-wide counts, and 20-record server-side pagination
- [x] Add guarded customer/admin role editing for active accounts with self-role, last-admin, and audit safeguards
- [x] Add seed data for admin user approval queue
- [x] Add Thai admin/staff compliance, integration readiness, DB-offline, notification, and payment evidence copy polish
- [x] Add data-backed admin payment review queue foundation
- [x] Add payment review clarity for admin evidence, provider result, QR payload, slip URL, reviewer, and Thai status labels
- [x] Add manual admin payment verify/reject Server Action boundaries
- [x] Extract manual payment review rules into a tested domain service
- [x] Add data-backed admin order management queue foundation
- [x] Add manual admin order fulfillment Server Action boundaries
- [x] Add data-backed admin inventory management queue foundation
- [x] Add manual admin inventory update Server Action boundaries

## Phase 9: Customer And Commerce Workflows

- [x] Build admin product catalog management
- [x] Add product image upload UX stub and hosted URL guidance for upload-ready admin catalog testing
- [x] Build product browsing
- [x] Build product detail view
- [x] Build cart workflow
- [x] Build checkout foundation
- [x] Build Thai QR payment instruction flow
- [x] Build customer order list
- [x] Build customer order tracking
- [x] Build admin order management
- [x] Minimize admin order management steps
- [x] Build slip upload UX stub, local QR extraction, hosted URL fallback, and payment review workflow
- [x] Build admin manual payment review foundation
- [x] Add SlipOK/EasySlip verification API boundary
- [x] Extract provider slip verification persistence into the payment domain service
- [x] Integrate selected Slip Verification API with final slip upload UI
- [x] Build inventory management
- [x] Remove saleable Store fallback/sample products, checkout QR/address/slip placeholders, and dead product-detail controls from database-backed purchase paths
- [x] Add guarded checkout idempotency, cart fingerprinting, stale-cart visibility, PromptPay readiness checks, and compare-and-swap stock reservation
- [x] Harden order payment verification with evidence XOR validation, retry cooldown, payment/order compare-and-swap transitions, transaction-reference reuse checks, verified-only rewards, and verified inventory finalization
- [x] Claim submitted payment evidence before provider verification, preserve provider outages for Admin manual review, fail closed on missing/mismatched amount or receiver, and enforce fixed reservation cutoffs during payment finalization
- [x] Harden doctor-issued prescription ordering with PromptPay readiness, prescription row locking, Serializable transactions, and compare-and-swap stock reservation
- [x] Add Store reservation expiry and stock release for `pending_payment` after 30 minutes and `payment_review` after 24 hours, with Serializable/CAS cleanup, audit logs, notifications, and a three-active-order customer cap
- [x] Persist customer shipping addresses and an immutable order shipping-address snapshot before production fulfillment; Production deploy, health check, additive migration, and Shipping Address UAT passed 7/7
- [x] Pass Controlled Test Product Checkout + Reservation Cleanup Production UAT: Customer `sekmon` completed Product, Cart, Checkout, and Order `CE-8JYOBW` for one ฿199 test product; shipping snapshot, stock reservation/release, cancelled-history visibility, Notification, and Audit were verified after owner-triggered expiry cleanup
- [ ] Complete Production Checkout and Order Snapshot UAT with the client's real product and stock data imported from Excel
- [ ] Configure SlipOK/Payment Verification credentials and complete the separately approved Controlled Real-slip UAT. Private Plesk payment-slip upload is complete; SlipOK has no sandbox/test fixture, so do not use real money or slips before that approval.
- [x] Remove only the UTF-8 BOM (`EF BB BF`) from `20260513120000_init/migration.sql`; a fresh Local Docker database replayed all 12 repository migrations successfully, `prisma migrate status` and schema diff passed, and table/index/foreign-key/enum metadata matched the prior sanitized verification database. The checksum changed, existing Local migration records were left untouched, and Production was not connected.
- [x] Establish a Prisma migration baseline for the existing Production schema: Production MariaDB 11.8.6 now has all 12 migrations recorded, `prisma migrate status` is up to date, and schema diff is clean
- [x] Add guarded Plesk runtime Prisma migration runner: root `server.js` derives the latest source migration target and invokes Prisma through `process.execPath` only when `PLESK_MIGRATION_TARGET` exactly matches; absent/wrong flags preserve normal startup, failures prevent the new standalone process, child output/environment values stay out of logs, and the operator removes the flag after verified deployment
- [x] Require doctors to select an active in-stock prescription product and quantity when issuing a prescription; persist the selected product ID in the existing structured prescription item, show customers only the doctor-selected items, and derive all order lines server-side without a schema migration or name-based matching
- [x] Fix the customer prescription read model so a cancelled or refunded linked Order does not hide the retry action; add regression coverage for retrying a doctor-issued prescription after unpaid customer cancellation or refund
- [ ] Normalize prescription-item-to-product mapping into dedicated relational data and add the owner-approved database uniqueness rule for one active order per doctor-issued prescription, after legacy data review and a rollback-ready additive migration plan
- [x] Add an authenticated scheduled/global reservation cleanup worker so abandoned orders are reclaimed without waiting for the same customer to return; the GitHub Actions five-minute scheduler completed automatic scheduled Run ID `31260602414` successfully and the Production cleanup endpoint responded successfully. Plesk Scheduled Task execution remains disabled and is not the production scheduler.
- [x] Add customer cancellation for owned unpaid Store orders in `pending_payment`, reusing the existing Serializable/CAS reservation release path for exactly-once stock release, pending payment/shipment closure, audit logging, notification, idempotency, and cleanup-worker concurrency safety; deploy commit `2d272d6` passed health and controlled Production UAT, and regression coverage proves native-confirm rejection blocks dispatch while acceptance dispatches once
- [x] Add refund stock-release and real refund handling after Payment Integration/SlipOK activation is ready; unpaid customer cancellation remains separate from a refund
- [x] Add Admin-only Manual Store Refund MVP: external-bank-transfer confirmation, full-amount-only validation, separate normalized unique outgoing reference, Serializable/CAS refund transition, non-sent shipment cancellation, exactly-once stock restoration and compensating reward reversal (negative balance allowed), notification/audit, idempotent rerun, Thai policy, and additive rollback-ready migration; Production deployment/migration remains pending
- [x] Persist a normalized bank transaction reference for Provider and Admin manual reviews, enforce additive database uniqueness across verified/refunded payments, preserve null legacy/pending/rejected rows without JSON backfill, and document the rollback/pre-deploy audit plan; Production migration/deployment remains pending
- [ ] Replace hosted-URL inputs for external prescription attachments with real Cloudinary/S3 upload and approved external-prescription review handling; payment slips already use private Plesk storage
- [x] Connect Store category and keyword-search controls to active Prisma product data with validated URL filters and filtered empty/error states; Production deploy `55bc5c5` completed with Build 1, Restart 1, Recovery 0, HTTP 200/`status: ok` health, route smoke, and authenticated Customer `sekmon` read-only UAT at `390×844` covering category, keyword, combined query parameters, reload persistence, invalid/empty states, FooterNav, overflow, Console, and Network. Out-of-stock safety remains unexercised because no active out-of-stock product was available; no cart/order/payment/slip or business data was changed.
- [ ] After separate approval, execute a Controlled Production browse-only catalog import through the audited Admin UI: take a fresh database backup and Product/Inventory snapshot, create the 10 owner-approved UAT products as drafts with `0/0/0` inventory defaults and provisional regulated/stock fields omitted, verify exact slugs/content/images/prices, activate with zero saleable stock only for Customer catalog UAT, and retain a non-destructive archive/field-restore rollback path; never run the full development seed or perform Checkout/Payment in this step
- [ ] Connect Store carrier tracking to a real integration

## Phase 10: Consultation And Pharmacy Workflows

- [x] Build doctor consultation list
- [x] Add doctor consultation workflow polish for readiness, payment status, assessment, chat, and prescription actions
- [x] Build patient log access for doctors
- [x] Add Thai doctor patient-log language and privacy polish
- [x] Add admin customer and assessment oversight with privacy-scoped summary and detail views
- [x] Let admins request a fresh customer assessment by expiring active assessments non-destructively with audit logging
- [x] Add a guarded operator script and back up/reset the localhost assessment, appointment, consultation-message, prescription, slot-lock, and related-notification test data while preserving users, products, inventory, orders, and audit history
- [x] Require an active customer assessment before allowing direct access to `/consult`
- [x] Make localhost Customer QA use an active database customer from the Plesk copy, remove seed-ID coupling from approved-doctor booking, and fall back safely when host-only doctor photo bytes are unavailable
- [ ] Back up and run the confirmed test-flow reset against the Plesk database after production database access is provided and the exact target database is verified
- [x] Build admin schedule editor for doctor availability
- [x] Add in-place doctor availability editing and replace the icon-only schedule toggle with explicit Thai activate/deactivate labels
- [x] Build Zoom Meeting SDK client-view integration, Server-to-Server meeting creation, signature generation, and signed webhook handling; production owner credentials and hosted end-to-end validation remain pending
- [x] Complete local Zoom Production Pre-Credential Readiness: server-only S2S/OAuth/ZAK flow, minimum-lifetime SDK signatures, owner/role guards, signed webhook replay handling, mock coverage, and owner setup/UAT/rollback guide; owner credential entry and non-monetary Production UAT remain pending
- [x] Build persisted in-app consultation chat foundation separate from LINE
- [x] Remove live-room demo messages and bind the room to participant-scoped persisted messages with near-real-time refresh
- [x] Persist consultation payment evidence and status in the shared Payment entity
- [x] Add guarded doctor appointment lifecycle controls for scheduled, live, and completed states
- [x] Add assigned-patient detail with full pre-consult assessment visibility and audited privacy access
- [x] Add doctor-owned in-app notification screen and read actions
- [x] Build structured prescription writing workflow with medicine, dosage, quantity, instructions, and warnings
- [x] Extract doctor-issued prescription writing rules into a tested domain service
- [x] Keep the pharmacist prescription queue as read-only reference without making it an approval gate
- [x] Make doctor-issued prescriptions immediately order-ready without pharmacist verification
- [x] Build Admin-owned medicine preparation and shipment workflow
- [x] Restrict fulfillment status updates to Admin while retaining read-only Pharmacist screens and role boundaries
- [x] Mark linked prescriptions dispensed on Admin shipment, preserve actor-aware audit history, and show the fulfillment operator timeline in Admin orders
- [x] Add Thai admin inventory, payment, order, schedule, and pharmacist prescription queue copy polish
- [x] Deploy Transparent Session Refresh to Production at `e6334d6`, pass health check, and pass Doctor route smoke UAT for notifications, consultations, and patients without LINE Login after access-cookie removal
- [x] Preserve Doctor queue appointment duration through the `consultation.book_slot` AuditLog snapshot after slot-lock cleanup; this is an interim no-migration solution with safe legacy recovery/fallback. Production UAT after deploy `7ed3076` passed for `sekmon`'s 3 August 2026 09:00 booking (60 minutes), including expiry/cancellation after lock deletion and mobile layout.
- [x] Move the immutable booked-duration snapshot from AuditLog metadata into nullable `Consultation.bookedDurationMinutes`; keep AuditLog/availability recovery only for normalized-null legacy records, with safe local MariaDB 11.8.6 backup-clone rehearsal
- [x] Deploy the additive booked-duration snapshot migration and its safe backfill through the approved Production backup/maintenance plan at commit `21d7915`; Production now has 13 finished Prisma migrations and 0 rolled back, while ambiguous historic records remain null and display `ยังไม่ระบุ`
- [x] Add the Admin Bulk Schedule Editor using the existing `DoctorAvailability` model: one-doctor multi-day selection, multiple mixed-duration blocks, preview/copy-before-save workflow, serializable all-or-nothing batch creation, overlap/duplicate protection, and per-record audit logs while retaining legacy edit and enable/disable controls
- [x] Add date-specific doctor availability overrides and Schedule calendar: special times extend recurring availability, holidays close the selected date, booking-slot deduplication/locking is preserved, and Admin cannot deactivate or delete an override with an appointment. Manual Local UAT passed for Websthai on 8–9 August 2026, including Customer booking, duplicate booking prevention, mobile `390×844`, Console, and Network checks. Production migration/deployment and controlled UAT passed on 2026-08-08 at commit `6359451`; owner approved retaining the 17 August 17:00–18:00 special override and 18 August holiday as Production example schedules.
- [ ] Configure SlipOK credentials and privacy approval for consultation payments, then complete a separately approved Controlled Real-slip UAT (including PromptPay, provider verification, and webhook) before Full Doctor Flow Production UAT; EasySlip remains inactive fallback

## Phase 11: Articles, Community, And Notifications

- [x] Build articles
- [x] Read Community hub, search, saved articles, and article detail from published Prisma records without public fallback content
- [x] Build customer-owned post creation and editing with privacy acknowledgement, ownership checks, rate limiting, and audit logs
- [x] Add one-image Community post upload with browser compression, server-side WebP reprocessing, EXIF removal, private host storage, and owner-controlled replacement/removal
- [x] Build article comments
- [x] Build likes
- [x] Build customer-scoped saved articles
- [x] Build content reporting for articles and comments
- [x] Build persistent report records and connect them to the admin moderation queue without automatically hiding reported content
- [x] Build admin moderation workflow with keep, hide, archive, audit, and customer notification outcomes
- [x] Minimize admin moderation steps
- [x] Build notifications
- [x] Back customer notification center with Prisma notifications
- [x] Build reward points earning and spending rules
- [x] Add audit metadata for sensitive actions
- [x] Complete Community launch-readiness documentation and Local verification: approved Thai policy, post/comment/report/moderation/notification/image-access UAT at 390×844 with non-sensitive `[UAT]` content, retained Audit/Report history, focused Community tests, full unit suite, lint, typecheck, and production build

## Phase 12: Quality And Deployment

- [x] Add unit tests for permission helpers
- [x] Add component tests for reusable Stitch-based UI primitives
- [x] Verify footer navigation consistency across screens
- [x] Verify final footer labels: `Consult`, `Store`, `Community`, `Profile`
- [x] Verify mobile-first LINE LIFF viewport behavior
- [x] Complete Customer mobile UI polish pass 1 for Consult, Store, Cart, Checkout, and Profile while preserving Stitch layout, tokens, FooterNav, and existing flows
- [x] Deploy Customer mobile UI polish pass 1 at `43debd4` and pass read-only Production UAT with `sekmon` at `390×844`: Consult, Store, Cart, Checkout, and Profile have no horizontal overflow; Store/Cart/Checkout/Profile retain FooterNav; Consult hides FooterNav behind the assessment gate; no UAT data was created or changed
- [x] Add integration tests for protected workflows
- [x] Add Playwright smoke tests
- [x] Add readable Thai localhost team testing guide for customer, doctor, pharmacist, and admin flows
- [x] Configure preview deployments
- [x] Configure staging environment
- [x] Configure production environment
- [x] Add Plesk Node.js standalone deployment readiness docs and config
- [x] Add Plesk standalone artifact build script
- [x] Bundle Plesk-compatible Prisma engines in the standalone artifact and add safe LINE session failure diagnostics
- [x] Add Plesk dry-run checklist, hosted smoke checks, and production environment grouping for owner-managed deployment
- [x] Add remote team testing guide for Plesk hosted QA without exposing secrets or real sensitive data
- [x] Add cPanel-to-Plesk migration handoff after the temporary cPanel proof-of-run and LINE LIFF smoke check
- [x] Run protected-route middleware on the Node.js runtime so Plesk JWT refresh and route verification share runtime secrets
- [x] Add Plesk GitHub deployment build helper for standalone Next.js runtime output
- [x] Add responsive desktop admin navigation, admin logout, and public-origin LINE OAuth redirects for Passenger/Plesk
- [x] Add temporary private Plesk uploads for staff profile photos and license proofs from Admin review, with admin-only license access, approval prerequisites, file metadata, and audit logs; keep public staff requests text-only to avoid exposing upload handling to the Plesk WAF
- [x] Keep doctor/pharmacist applicants active as customers during review, show a Thai pending-review confirmation, expose clearer admin document-review controls, and create an in-app approval notification
- [x] Normalize doctor specialty requests with a controlled multi-select list and optional custom specialty
- [x] Complete hosted Plesk staff-access smoke deployment: HTTPS, health checks, Git/Node deployment, route-specific LINE Login returns, and read-only authenticated Doctor access are verified; authenticated Pharmacist UAT is deferred until an existing approved session is available because Pharmacist is read-only context and not a Soft Launch blocker
- [x] Enable backups
- [x] Enable error monitoring
- [x] Review compliance requirements before production launch

## Later Candidates

- [ ] Add customer email/password or magic-link login after the LINE Mini App MVP is complete
- [ ] Full patient portal
- [ ] Online appointment scheduling
- [ ] Automated payment gateway capture
- [ ] Delivery carrier integrations
- [ ] Before-and-after image comparison
- [ ] Email notifications
- [ ] Multi-location support
- [ ] AI-assisted note drafting
- [ ] AI-assisted treatment summaries
- [ ] Reporting exports

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
- [ ] Receive product catalog with prices, images, stock, prescription-required flags, warnings, and storage rules; FDA numbers are still pending
- [ ] Receive clinic-as-pharmacy license direction and facility license document; client says prescription-required products can be purchased by attaching a prescription without an additional document-review step, but pharmacist-specific data is not provided, so confirm whether pharmacist role remains needed for MVP fulfillment operations only
- [x] Update in-app doctor-issued prescription ordering so customers can buy prescription-required products without an additional pharmacist/document verification gate while preserving prescription, order, payment, shipment, reward, inventory, and audit linkage
- [x] Add external prescription attachment metadata foundation and upload UX stub for prescription-required purchases using owner-managed storage URLs, order linkage, attachment visibility, and audit logs without storing file bytes in the database
- [x] Add in-app consultation chat foundation that is not LINE chat, with persisted Prisma/MySQL messages, consultation access checks, audit logs, notifications, live consult UI binding, and latest-message visibility in the doctor queue
- [x] Add owner-managed integration readiness panel for PromptPay, EasySlip/SlipOK, storage, LINE LIFF, and Zoom without exposing secret values
- [x] Add file storage foundation for Cloudinary/S3 readiness, hosted URL base validation, storage key extraction, external prescription metadata, and payment slip metadata without storing file bytes in the database
- [x] Draft prescription verification, medicine preparation, and shipment SOP flows for client review
- [x] Confirm PromptPay phone/tax ID intake; secure production payment configuration remains owner-managed through environment secrets
- [ ] Configure EasySlip API details securely as owner-managed setup
- [ ] Defer article content, article categories, community rules, and moderation policy until after MVP unless Community returns to MVP scope
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
- [ ] Configure LINE LIFF channel
- [x] Implement LINE LIFF client login entrypoint
- [x] Implement LINE LIFF ID-token verification endpoint
- [x] Implement JWT issuing and validation
- [x] Implement persisted JWT refresh token revocation or re-authentication strategy
- [x] Implement initial JWT refresh endpoint
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

## Phase 10: Consultation And Pharmacy Workflows

- [x] Build doctor consultation list
- [x] Add doctor consultation workflow polish for readiness, payment status, assessment, chat, and prescription actions
- [x] Build patient log access for doctors
- [x] Add Thai doctor patient-log language and privacy polish
- [x] Build admin schedule editor for doctor availability
- [ ] Build Zoom SDK video consultation room integration
- [x] Build persisted in-app consultation chat foundation separate from LINE
- [x] Build prescription writing workflow
- [x] Extract doctor-issued prescription writing rules into a tested domain service
- [x] Build pharmacist prescription queue
- [x] Build prescription verification workflow
- [x] Build medicine preparation workflow
- [x] Build pharmacist order status updates
- [x] Add Thai pharmacist order language and fulfillment status polish
- [x] Add Thai admin inventory, payment, order, schedule, and pharmacist prescription queue copy polish

## Phase 11: Articles, Community, And Notifications

- [x] Build articles
- [x] Build article comments
- [x] Build likes
- [x] Build content reporting for articles and comments
- [x] Build admin moderation workflow
- [x] Minimize admin moderation steps
- [x] Build notifications
- [x] Back customer notification center with Prisma notifications
- [x] Build reward points earning and spending rules
- [x] Add audit metadata for sensitive actions

## Phase 12: Quality And Deployment

- [x] Add unit tests for permission helpers
- [x] Add component tests for reusable Stitch-based UI primitives
- [x] Verify footer navigation consistency across screens
- [x] Verify final footer labels: `Consult`, `Store`, `Community`, `Profile`
- [x] Verify mobile-first LINE LIFF viewport behavior
- [x] Add integration tests for protected workflows
- [x] Add Playwright smoke tests
- [x] Add readable Thai localhost team testing guide for customer, doctor, pharmacist, and admin flows
- [x] Configure preview deployments
- [x] Configure staging environment
- [x] Configure production environment
- [x] Add Plesk Node.js standalone deployment readiness docs and config
- [x] Add Plesk standalone artifact build script
- [x] Add Plesk dry-run checklist, hosted smoke checks, and production environment grouping for owner-managed deployment
- [x] Add remote team testing guide for Plesk hosted QA without exposing secrets or real sensitive data
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

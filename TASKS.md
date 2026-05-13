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

- [ ] Receive Thai PDPA Privacy Policy
- [ ] Receive Thai Terms of Service
- [ ] Receive health-data, teleconsultation, prescription, and pharmacy consent wording
- [ ] Receive company name, tax ID, billing address, parcel sender address, and support contact
- [ ] Receive doctor bio, education, specialty, license number, consultation fee, schedule, and official profile photo
- [ ] Receive product catalog with FDA numbers, prices, images, stock, and prescription-required flags
- [ ] Receive pharmacy and pharmacist license data
- [ ] Receive prescription verification, medicine preparation, and shipment SOPs
- [ ] Confirm PromptPay phone/tax ID, bank account name, bank, and secure storage location
- [ ] Choose SlipOK or EasySlip and receive API details securely
- [ ] Receive article content, article categories, community rules, and moderation policy
- [ ] Receive or export Stitch source/tokens/assets

## Phase 1: Project Scaffolding And Frontend Foundation

- [ ] Initialize git repository, if desired
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
- [ ] Establish Next.js Server Actions conventions
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
- [ ] Implement doctor, pharmacist, and admin invitation flow
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
- [ ] Add migrations
- [x] Add seed data for local development

## Phase 3.5: API And Domain Structure

- [ ] Create feature action files
- [ ] Create feature query files
- [ ] Create domain service files
- [ ] Create Zod validation schemas
- [x] Create permission helpers
- [x] Add route handlers for LINE callback, payment webhook, Zoom webhook, and health check

## Phase 4: Reusable UI Component System

- [x] Build `AppShell`
- [ ] Build `Screen`
- [ ] Build `SafeArea`
- [x] Build `FooterNav`
- [x] Build `TopBar`
- [x] Build `GlassSurface`
- [ ] Build `Button`
- [ ] Build `IconButton`
- [ ] Build `TextField`
- [ ] Build `SearchField`
- [x] Build `StatusBadge`
- [ ] Build `BottomSheet`
- [ ] Build `EmptyState`
- [x] Build `DoctorCard`
- [x] Build `BookingCalendar`
- [x] Build `TimeSlotButton`
- [x] Build `PromptPayQrPanel`
- [x] Build `SlipUploadBox`
- [ ] Build `PaymentStatusBadge`
- [ ] Build `OrderTrackingTimeline`
- [ ] Build `CommunityPostCard`
- [ ] Build `ArticleCard`
- [ ] Build `CommentComposer`
- [ ] Build `NotificationItem`
- [ ] Build `ProfileSettingsItem`
- [ ] Build reusable domain cards and rows from Stitch patterns

## Phase 5: Consult Stitch Screens

- [x] Build doctor list screen
- [x] Build doctor profile and booking screen
- [x] Build consultation PromptPay checkout screen
- [x] Build consultation waiting room screen
- [x] Build live consultation screen shell
- [x] Build advice log screen
- [ ] Add booking confirmation supporting screen if needed
- [ ] Add payment pending/rejected supporting screens if needed
- [ ] Add appointment detail supporting screen if needed
- [ ] Add prescription verification status supporting screen if needed

## Phase 6: Store Stitch Screens

- [x] Build health marketplace screen
- [x] Build product detail screen
- [x] Build store checkout screen
- [x] Build payment success and tracking screen
- [ ] Add order from prescription supporting screen if needed
- [ ] Add order detail supporting screen if needed
- [ ] Validate prescription-required purchase flow

## Phase 7: Community And Profile Stitch Screens

- [x] Build user profile screen
- [x] Build community hub screen
- [x] Build create post screen
- [x] Build article/post detail and comments screen
- [x] Build notification center screen
- [x] Build community search results screen
- [ ] Add saved articles supporting screen if needed
- [ ] Add shipping addresses supporting screen if needed
- [ ] Add settings supporting screen if needed

## Phase 8: Admin Dashboard

- [x] Build authenticated dashboard shell
- [x] Add admin navigation foundation
- [x] Use dedicated admin persistent navigation
- [x] Add role-aware admin route visibility
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
- [x] Add data-backed admin payment review queue foundation
- [x] Add manual admin payment verify/reject Server Action boundaries
- [x] Add data-backed admin order management queue foundation
- [x] Add manual admin order fulfillment Server Action boundaries
- [x] Add data-backed admin inventory management queue foundation
- [x] Add manual admin inventory update Server Action boundaries

## Phase 9: Customer And Commerce Workflows

- [ ] Build product browsing
- [ ] Build product detail view
- [ ] Build cart workflow
- [ ] Build checkout foundation
- [ ] Build Thai QR payment instruction flow
- [ ] Build customer order list
- [ ] Build customer order tracking
- [x] Build admin order management
- [x] Minimize admin order management steps
- [ ] Build slip upload and payment review workflow
- [x] Build admin manual payment review foundation
- [ ] Integrate Slip Verification API
- [x] Build inventory management

## Phase 10: Consultation And Pharmacy Workflows

- [x] Build doctor consultation list
- [x] Build patient log access for doctors
- [ ] Build Zoom SDK video consultation room integration
- [ ] Build prescription writing workflow
- [x] Build pharmacist prescription queue
- [x] Build prescription verification workflow
- [x] Build medicine preparation workflow
- [x] Build pharmacist order status updates

## Phase 11: Articles, Community, And Notifications

- [ ] Build articles
- [ ] Build article comments
- [ ] Build likes
- [ ] Build content reporting for articles and comments
- [ ] Build admin moderation workflow
- [ ] Minimize admin moderation steps
- [ ] Build notifications
- [ ] Build reward points earning and spending rules
- [ ] Add audit metadata for sensitive actions

## Phase 12: Quality And Deployment

- [ ] Add unit tests for permission helpers
- [ ] Add component tests for reusable Stitch-based UI primitives
- [ ] Verify footer navigation consistency across screens
- [ ] Verify final footer labels: `Consult`, `Store`, `Community`, `Profile`
- [ ] Verify mobile-first LINE LIFF viewport behavior
- [ ] Add integration tests for protected workflows
- [ ] Add Playwright smoke tests
- [ ] Configure preview deployments
- [ ] Configure staging environment
- [ ] Configure production environment
- [ ] Enable backups
- [ ] Enable error monitoring
- [ ] Review compliance requirements before production launch

## Later Candidates

- [ ] Add customer email/password or magic-link login after the LINE Mini App MVP is complete
- [ ] Full patient portal
- [ ] Online appointment scheduling
- [ ] Automated payment gateway capture
- [ ] Delivery carrier integrations
- [ ] Before-and-after image comparison
- [ ] Email notifications
- [ ] SMS notifications
- [ ] Multi-location support
- [ ] AI-assisted note drafting
- [ ] AI-assisted treatment summaries
- [ ] Reporting exports
